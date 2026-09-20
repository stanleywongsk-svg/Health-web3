import ExpoModulesCore
import HealthKit

public class HealthLoopHealthModule: Module {
  private let store = HKHealthStore()
  private let lock = NSLock()
  private var pending: [UUID: (HKQuery, Promise)] = [:]

  public func definition() -> ModuleDefinition {
    Name("HealthLoopHealth")
    Function("isAvailable") { HKHealthStore.isHealthDataAvailable() }
    // Resolving means the permission sheet completed, never that read access was granted.
    AsyncFunction("requestRead") { (metrics: [String], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("UNAVAILABLE", "HealthKit unavailable"); return
      }
      let types = Set(metrics.compactMap { self.sampleType($0) as HKObjectType? })
      guard types.count == metrics.count, !types.isEmpty else {
        promise.reject("INVALID_METRIC", "Unsupported metric"); return
      }
      self.store.requestAuthorization(toShare: [], read: types) { completed, error in
        if error != nil || !completed { promise.reject("REQUEST_FAILED", "Health access request did not complete") }
        else { promise.resolve() }
      }
    }
    AsyncFunction("query") { (metric: String, startMs: Double, endMs: Double, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(), let type = self.sampleType(metric) else {
        promise.reject("UNAVAILABLE", "Metric unavailable"); return
      }
      guard startMs.isFinite, endMs.isFinite, endMs > startMs, endMs - startMs <= 8 * 86400000 else {
        promise.reject("INVALID_RANGE", "Read range must be within eight days"); return
      }
      let id = UUID()
      let predicate = HKQuery.predicateForSamples(withStart: Date(timeIntervalSince1970: startMs / 1000), end: Date(timeIntervalSince1970: endMs / 1000), options: [])
      let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 100001, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
        self.lock.lock()
        let active = self.pending.removeValue(forKey: id)
        self.lock.unlock()
        guard active != nil else { return }
        if error != nil { promise.reject("QUERY_FAILED", "Health query failed"); return }
        guard let samples = samples, samples.count <= 100000 else {
          promise.reject("QUERY_LIMIT", "Too many records; query was not aggregated"); return
        }
        promise.resolve(samples.map { self.serialize($0, metric: metric) })
      }
      self.lock.lock()
      self.pending[id] = (query, promise)
      // Starting under the same lock closes the cancel-before-execute race.
      self.store.execute(query)
      self.lock.unlock()
    }
    Function("cancelAll") { self.cancelAll() }
    OnDestroy { self.cancelAll() }
  }

  private func cancelAll() {
    lock.lock()
    let queries = Array(pending.values)
    pending.removeAll()
    lock.unlock()
    for (query, promise) in queries {
      store.stop(query)
      promise.reject("CANCELLED", "Health query cancelled")
    }
  }
  private func sampleType(_ metric: String) -> HKSampleType? {
    switch metric {
    case "steps": return HKObjectType.quantityType(forIdentifier: .stepCount)
    case "sleep": return HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
    case "heartRate": return HKObjectType.quantityType(forIdentifier: .heartRate)
    default: return nil
    }
  }
  private func serialize(_ sample: HKSample, metric: String) -> [String: Any] {
    let revision = sample.sourceRevision
    let bundle = revision.source.bundleIdentifier
    let product = revision.productType ?? ""
    let manual = (sample.metadata?[HKMetadataKeyWasUserEntered] as? NSNumber)?.boolValue ?? false
    // Labels alone never determine eligibility. Unknown metadata fails closed.
    let apple = bundle == "com.apple.health" || bundle.hasPrefix("com.apple.health.")
    let category = apple && product.hasPrefix("Watch") ? "apple_watch" : apple && product.hasPrefix("iPhone") ? "apple_phone" : "unknown"
    var result: [String: Any] = [
      "id": sample.uuid.uuidString,
      "startAt": ISO8601DateFormatter().string(from: sample.startDate),
      "endAt": ISO8601DateFormatter().string(from: sample.endDate),
      "source": ["id": bundle + ":" + product, "name": revision.source.name, "category": category, "isManual": manual]
    ]
    if let quantity = sample as? HKQuantitySample {
      let unit = metric == "heartRate" ? HKUnit.count().unitDivided(by: .minute()) : HKUnit.count()
      result["value"] = quantity.quantity.doubleValue(for: unit)
    }
    if let category = sample as? HKCategorySample { result["value"] = category.value }
    return result
  }
}
