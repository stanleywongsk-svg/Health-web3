import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createChunkedStorage } from '../utils/secure-storage-core';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const secureStorage=createChunkedStorage({get:key=>SecureStore.getItemAsync(key,options),set:(key,value)=>SecureStore.setItemAsync(key,value,options),remove:key=>SecureStore.deleteItemAsync(key,options)},()=>Crypto.randomUUID());
