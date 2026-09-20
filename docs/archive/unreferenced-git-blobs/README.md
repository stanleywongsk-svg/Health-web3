# Unreferenced local Git blobs

A pre-cleanup `git fsck --full --no-reflogs` found these four unreferenced blobs. Their bytes are retained by original Git blob SHA to avoid losing local draft versions during later cleanup. They are historical recovery material, not current source or new requirements. Original filenames cannot be inferred reliably from an unreferenced blob alone.

All reachable branch histories are in the separate history bundle. Use the repository's current tracked source for implementation.
