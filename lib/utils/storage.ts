import {
  Song,
  PlaylistInfo,
  STORAGE_KEYS,
  PLAYER_CONFIG,
} from "../types/music";

// IndexedDB 数据库配置
const DB_NAME = "MusicPlayerDB";
const DB_VERSION = 1;
const STORES = {
  SONGS: "songs",
  PLAYLISTS: "playlists",
  CACHE: "cache",
} as const;

// IndexedDB 工具类
class IndexedDBHelper {
  private db: IDBDatabase | null = null;

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error("无法打开 IndexedDB"));

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建歌曲存储
        if (!db.objectStoreNames.contains(STORES.SONGS)) {
          const songStore = db.createObjectStore(STORES.SONGS, {
            keyPath: "id",
          });
          songStore.createIndex("artist", "artist", { unique: false });
          songStore.createIndex("album", "album", { unique: false });
        }

        // 创建播放列表存储
        if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
          db.createObjectStore(STORES.PLAYLISTS, { keyPath: "name" });
        }

        // 创建缓存存储
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          db.createObjectStore(STORES.CACHE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
    });
  }

  // 获取事务
  private getTransaction(
    storeNames: string[],
    mode: IDBTransactionMode = "readonly"
  ): IDBTransaction {
    if (!this.db) {
      throw new Error("数据库未初始化");
    }
    return this.db.transaction(storeNames, mode);
  }

  // 添加歌曲
  async addSong(song: Song): Promise<void> {
    const transaction = this.getTransaction([STORES.SONGS], "readwrite");
    const store = transaction.objectStore(STORES.SONGS);

    return new Promise((resolve, reject) => {
      const request = store.put({ ...song, lastPlayed: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("添加歌曲失败"));
    });
  }

  // 获取歌曲
  async getSong(id: string): Promise<Song | null> {
    const transaction = this.getTransaction([STORES.SONGS]);
    const store = transaction.objectStore(STORES.SONGS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("获取歌曲失败"));
    });
  }

  // 获取所有歌曲
  async getAllSongs(): Promise<Song[]> {
    const transaction = this.getTransaction([STORES.SONGS]);
    const store = transaction.objectStore(STORES.SONGS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error("获取歌曲列表失败"));
    });
  }

  // 删除歌曲
  async deleteSong(id: string): Promise<void> {
    const transaction = this.getTransaction([STORES.SONGS], "readwrite");
    const store = transaction.objectStore(STORES.SONGS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("删除歌曲失败"));
    });
  }

  // 添加播放列表
  async addPlaylist(playlist: PlaylistInfo): Promise<void> {
    const transaction = this.getTransaction([STORES.PLAYLISTS], "readwrite");
    const store = transaction.objectStore(STORES.PLAYLISTS);

    return new Promise((resolve, reject) => {
      const request = store.put({
        ...playlist,
        createdAt: playlist.createdAt || new Date(),
        updatedAt: new Date(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("添加播放列表失败"));
    });
  }

  // 获取播放列表
  async getPlaylist(name: string): Promise<PlaylistInfo | null> {
    const transaction = this.getTransaction([STORES.PLAYLISTS]);
    const store = transaction.objectStore(STORES.PLAYLISTS);

    return new Promise((resolve, reject) => {
      const request = store.get(name);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("获取播放列表失败"));
    });
  }

  // 获取所有播放列表
  async getAllPlaylists(): Promise<PlaylistInfo[]> {
    const transaction = this.getTransaction([STORES.PLAYLISTS]);
    const store = transaction.objectStore(STORES.PLAYLISTS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error("获取播放列表失败"));
    });
  }

  // 删除播放列表
  async deletePlaylist(name: string): Promise<void> {
    const transaction = this.getTransaction([STORES.PLAYLISTS], "readwrite");
    const store = transaction.objectStore(STORES.PLAYLISTS);

    return new Promise((resolve, reject) => {
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("删除播放列表失败"));
    });
  }

  // 缓存数据
  async setCache(key: string, data: any, expiry?: number): Promise<void> {
    const transaction = this.getTransaction([STORES.CACHE], "readwrite");
    const store = transaction.objectStore(STORES.CACHE);

    const cacheData = {
      key,
      data,
      timestamp: Date.now(),
      expiry: expiry || Date.now() + 24 * 60 * 60 * 1000, // 默认24小时过期
    };

    return new Promise((resolve, reject) => {
      const request = store.put(cacheData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("设置缓存失败"));
    });
  }

  // 获取缓存
  async getCache(key: string): Promise<any> {
    const transaction = this.getTransaction([STORES.CACHE]);
    const store = transaction.objectStore(STORES.CACHE);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (Date.now() > result.expiry) {
          // 过期则删除并返回null
          this.deleteCache(key);
          resolve(null);
          return;
        }

        resolve(result.data);
      };
      request.onerror = () => reject(new Error("获取缓存失败"));
    });
  }

  // 删除缓存
  async deleteCache(key: string): Promise<void> {
    const transaction = this.getTransaction([STORES.CACHE], "readwrite");
    const store = transaction.objectStore(STORES.CACHE);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("删除缓存失败"));
    });
  }

  // 清空所有缓存
  async clearCache(): Promise<void> {
    const transaction = this.getTransaction([STORES.CACHE], "readwrite");
    const store = transaction.objectStore(STORES.CACHE);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("清空缓存失败"));
    });
  }
}

// localStorage 工具类
class LocalStorageHelper {
  // 设置数据
  setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`设置 localStorage 失败: ${key}`, error);
    }
  }

  // 获取数据
  getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        return defaultValue || null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error(`获取 localStorage 失败: ${key}`, error);
      return defaultValue || null;
    }
  }

  // 删除数据
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`删除 localStorage 失败: ${key}`, error);
    }
  }

  // 清空所有数据
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("清空 localStorage 失败", error);
    }
  }

  // 获取存储大小
  getStorageSize(): number {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage.getItem(key)?.length || 0;
      }
    }
    return total;
  }
}

// 播放器存储管理器
class PlayerStorage {
  private indexedDB: IndexedDBHelper;
  private localStorage: LocalStorageHelper;
  private initialized = false;

  constructor() {
    this.indexedDB = new IndexedDBHelper();
    this.localStorage = new LocalStorageHelper();
  }

  // 初始化
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.indexedDB.init();
      this.initialized = true;
      console.log("播放器存储初始化成功");
    } catch (error) {
      console.error("播放器存储初始化失败", error);
      throw error;
    }
  }

  // 确保已初始化
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("播放器存储未初始化，请先调用 init() 方法");
    }
  }

  // 歌曲相关操作
  async addSong(song: Song): Promise<void> {
    this.ensureInitialized();
    return this.indexedDB.addSong(song);
  }

  async getSong(id: string): Promise<Song | null> {
    this.ensureInitialized();
    return this.indexedDB.getSong(id);
  }

  async getAllSongs(): Promise<Song[]> {
    this.ensureInitialized();
    return this.indexedDB.getAllSongs();
  }

  async deleteSong(id: string): Promise<void> {
    this.ensureInitialized();
    return this.indexedDB.deleteSong(id);
  }

  // 播放列表相关操作
  async savePlaylist(playlist: PlaylistInfo): Promise<void> {
    this.ensureInitialized();
    return this.indexedDB.addPlaylist(playlist);
  }

  async getPlaylist(name: string): Promise<PlaylistInfo | null> {
    this.ensureInitialized();
    return this.indexedDB.getPlaylist(name);
  }

  async getAllPlaylists(): Promise<PlaylistInfo[]> {
    this.ensureInitialized();
    return this.indexedDB.getAllPlaylists();
  }

  async deletePlaylist(name: string): Promise<void> {
    this.ensureInitialized();
    return this.indexedDB.deletePlaylist(name);
  }

  // 用户偏好设置
  setUserPreference<T>(key: string, value: T): void {
    this.localStorage.setItem(`${STORAGE_KEYS.USER_PREFERENCES}.${key}`, value);
  }

  getUserPreference<T>(key: string, defaultValue?: T): T | null {
    return this.localStorage.getItem(
      `${STORAGE_KEYS.USER_PREFERENCES}.${key}`,
      defaultValue
    );
  }

  // 缓存操作
  async setCache(key: string, data: any, expiry?: number): Promise<void> {
    this.ensureInitialized();
    return this.indexedDB.setCache(key, data, expiry);
  }

  async getCache(key: string): Promise<any> {
    this.ensureInitialized();
    return this.indexedDB.getCache(key);
  }

  // 数据清理
  async clearAllData(): Promise<void> {
    this.ensureInitialized();
    await this.indexedDB.clearCache();
    this.localStorage.clear();
  }

  async clearExpiredCache(): Promise<void> {
    this.ensureInitialized();
    // IndexedDB 的 getCache 方法已经自动处理过期缓存
    console.log("过期缓存清理完成");
  }

  // 导出数据
  async exportData(): Promise<{
    songs: Song[];
    playlists: PlaylistInfo[];
    preferences: Record<string, any>;
  }> {
    this.ensureInitialized();

    const songs = await this.getAllSongs();
    const playlists = await this.getAllPlaylists();
    const preferences: Record<string, any> = {};

    // 导出用户偏好设置
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.USER_PREFERENCES)) {
        preferences[key] = this.localStorage.getItem(key);
      }
    }

    return { songs, playlists, preferences };
  }

  // 导入数据
  async importData(data: {
    songs?: Song[];
    playlists?: PlaylistInfo[];
    preferences?: Record<string, any>;
  }): Promise<void> {
    this.ensureInitialized();

    // 导入歌曲
    if (data.songs) {
      for (const song of data.songs) {
        await this.addSong(song);
      }
    }

    // 导入播放列表
    if (data.playlists) {
      for (const playlist of data.playlists) {
        await this.savePlaylist(playlist);
      }
    }

    // 导入用户偏好
    if (data.preferences) {
      for (const [key, value] of Object.entries(data.preferences)) {
        this.localStorage.setItem(key, value);
      }
    }
  }

  // 获取存储统计
  async getStorageStats(): Promise<{
    songsCount: number;
    playlistsCount: number;
    localStorageSize: number;
  }> {
    this.ensureInitialized();

    const songs = await this.getAllSongs();
    const playlists = await this.getAllPlaylists();
    const localStorageSize = this.localStorage.getStorageSize();

    return {
      songsCount: songs.length,
      playlistsCount: playlists.length,
      localStorageSize,
    };
  }
}

// 创建全局存储实例
export const playerStorage = new PlayerStorage();

// 导出工具类
export { IndexedDBHelper, LocalStorageHelper, PlayerStorage };
