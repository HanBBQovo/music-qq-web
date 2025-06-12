import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Song,
  SearchParams,
  SearchResult,
  AlbumSearchItem,
  PlaylistSearchItem,
} from "../api/types";
import musicApi from "../api/client";
import { toast } from "sonner";
import { debounce } from "../utils";

// 搜索结果缓存接口
interface SearchCache {
  key: string;
  type: string;
  result: SearchResult;
  timestamp: number;
}

// 歌单详情缓存接口
interface PlaylistDetailCache {
  [playlistId: string]: {
    playlist: PlaylistSearchItem;
    timestamp: number;
  };
}

interface SearchState {
  // 搜索参数
  searchParams: Required<SearchParams>;
  // 搜索结果
  searchResult: SearchResult | null;
  // 当前页码
  page: number;
  // 每页显示数量
  pageSize: number;
  // 是否正在加载
  isLoading: boolean;
  // 是否正在加载更多
  isLoadingMore: boolean;
  // 是否出错
  isError: boolean;
  // 错误信息
  error: string | null;
  // 搜索缓存
  cache: Record<string, SearchCache>;
  // 缓存有效期（毫秒）
  cacheExpiry: number;
  // 歌单详情缓存
  playlistDetailCache: PlaylistDetailCache;

  // 便利访问器
  getSongs(): Song[];
  getAlbums(): AlbumSearchItem[];
  getPlaylists(): PlaylistSearchItem[];
  getTotal(): number;
  getHasMore(): boolean;
  // 获取缓存的歌单详情
  getCachedPlaylistDetail(playlistId: string): PlaylistSearchItem | null;

  // 方法
  setSearchKey: (key: string) => void;
  setSearchType: (type: "song" | "album" | "playlist") => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  search: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
  clearCache: () => void;
}

// 缓存键生成函数
const getCacheKey = (key: string, type: string): string => {
  return `${key}:${type}`.toLowerCase();
};

// 防抖搜索延迟（毫秒）
const SEARCH_DEBOUNCE_DELAY = 300;

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => {
      // 创建防抖搜索函数
      const debouncedSearch = debounce(async () => {
        const state = get();
        // 如果搜索关键词为空，则不执行搜索
        if (!state.searchParams.key) {
          set({ searchResult: null });
          return;
        }

        set({ isLoading: true, isError: false, error: null });

        try {
          // 检查缓存
          const cacheKey = getCacheKey(
            state.searchParams.key,
            state.searchParams.type
          );
          const cachedData = state.cache[cacheKey];
          const now = Date.now();

          // 如果缓存存在且未过期，使用缓存数据
          if (
            cachedData &&
            now - cachedData.timestamp < state.cacheExpiry &&
            state.searchParams.page === 1
          ) {
            console.log("[搜索] 使用缓存数据:", cacheKey);
            set({
              searchResult: cachedData.result,
              isLoading: false,
            });
            return;
          }

          // 显示搜索开始提示（只在实际发起网络请求时）
          toast.success(`正在搜索"${state.searchParams.key}"`, {
            description: `类型：${
              state.searchParams.type === "song"
                ? "歌曲"
                : state.searchParams.type === "album"
                ? "专辑"
                : "歌单"
            }`,
          });

          // 如果没有缓存或缓存已过期，请求新数据
          const response = await musicApi.search(state.searchParams);

          // 验证响应格式
          if (!response) {
            throw new Error("搜索返回了空响应");
          }

          // 验证响应状态码
          if (response.code !== 0) {
            throw new Error(
              response.message || `搜索失败，错误码: ${response.code}`
            );
          }

          // 验证数据是否存在
          if (!response.data) {
            throw new Error("搜索返回数据为空");
          }

          // 更新缓存
          if (state.searchParams.page === 1) {
            const newCache = {
              ...state.cache,
              [cacheKey]: {
                key: state.searchParams.key,
                type: state.searchParams.type,
                result: response.data,
                timestamp: now,
              },
            };

            // 如果是歌单搜索，同时缓存歌单详情
            const newPlaylistDetailCache = { ...state.playlistDetailCache };
            if (response.data.type === "playlist") {
              response.data.playlists.forEach((playlist) => {
                newPlaylistDetailCache[playlist.id.toString()] = {
                  playlist,
                  timestamp: now,
                };
              });
            }

            // 清理旧缓存
            const cacheEntries = Object.entries(newCache);
            if (cacheEntries.length > 20) {
              // 最多保留20个缓存项
              const oldestEntries = cacheEntries
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, cacheEntries.length - 20);

              for (const [key] of oldestEntries) {
                delete newCache[key];
              }
            }

            // 清理旧的歌单详情缓存
            const playlistCacheEntries = Object.entries(newPlaylistDetailCache);
            if (playlistCacheEntries.length > 50) {
              const oldestPlaylistEntries = playlistCacheEntries
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, playlistCacheEntries.length - 50);

              for (const [key] of oldestPlaylistEntries) {
                delete newPlaylistDetailCache[key];
              }
            }

            set({
              cache: newCache,
              playlistDetailCache: newPlaylistDetailCache,
            });
          }

          // 更新状态
          set({
            searchResult: response.data,
            isLoading: false,
          });

          // 如果没有搜索结果，显示提示
          const hasResults =
            (response.data.type === "song" && response.data.songs.length > 0) ||
            (response.data.type === "album" &&
              response.data.albums.length > 0) ||
            (response.data.type === "playlist" &&
              response.data.playlists.length > 0);

          if (!hasResults) {
            toast.info(`未找到与"${state.searchParams.key}"相关的结果`);
          }
        } catch (error) {
          console.error("搜索出错详情:", error);

          // 设置错误状态
          set({
            isLoading: false,
            isError: true,
            error: error instanceof Error ? error.message : "搜索出错",
            searchResult: null,
          });

          // 显示错误提示
          toast.error(
            `搜索失败: ${error instanceof Error ? error.message : "未知错误"}`
          );
        }
      }, SEARCH_DEBOUNCE_DELAY);

      return {
        // 初始状态
        searchParams: {
          key: "",
          page: 1,
          pageSize: 20,
          type: "song",
          cookie_id: "",
        },
        searchResult: null,
        page: 1,
        pageSize: 20,
        isLoading: false,
        isLoadingMore: false,
        isError: false,
        error: null,
        cache: {},
        cacheExpiry: 5 * 60 * 1000, // 5分钟缓存有效期
        playlistDetailCache: {},

        // 便利访问器
        getSongs: () => {
          const state = get();
          return state.searchResult?.type === "song"
            ? state.searchResult.songs
            : [];
        },

        getAlbums: () => {
          const state = get();
          return state.searchResult?.type === "album"
            ? state.searchResult.albums
            : [];
        },

        getPlaylists: () => {
          const state = get();
          return state.searchResult?.type === "playlist"
            ? state.searchResult.playlists
            : [];
        },

        getTotal: () => {
          const state = get();
          return state.searchResult?.total || 0;
        },

        getHasMore: () => {
          const state = get();
          return state.searchResult?.hasMore || false;
        },

        // 获取缓存的歌单详情
        getCachedPlaylistDetail: (playlistId: string) => {
          const state = get();
          return state.playlistDetailCache[playlistId]?.playlist || null;
        },

        // 设置搜索关键词
        setSearchKey: (key: string) =>
          set((state) => ({
            searchParams: {
              ...state.searchParams,
              key,
              page: 1, // 重置页码
            },
            page: 1,
          })),

        // 设置搜索类型
        setSearchType: (type: "song" | "album" | "playlist") =>
          set((state) => ({
            searchParams: {
              ...state.searchParams,
              type,
              page: 1, // 重置页码
            },
            page: 1,
            searchResult: null, // 清空之前的搜索结果
          })),

        // 设置页码
        setPage: (page: number) =>
          set((state) => ({
            searchParams: {
              ...state.searchParams,
              page,
            },
            page,
          })),

        // 设置每页显示数量
        setPageSize: (pageSize: number) =>
          set((state) => ({
            searchParams: {
              ...state.searchParams,
              pageSize,
            },
            pageSize,
          })),

        // 执行搜索
        search: async () => {
          debouncedSearch();
        },

        // 加载更多结果 (支持所有搜索类型)
        loadMore: async () => {
          const state = get();
          const { searchParams, searchResult, isLoading, isLoadingMore } =
            state;

          // 检查是否可以加载更多
          if (
            isLoading ||
            isLoadingMore ||
            !searchResult ||
            !searchResult.hasMore
          ) {
            return;
          }

          console.log("[加载更多] 开始加载下一页", { type: searchResult.type });
          set({ isLoadingMore: true });

          try {
            // 请求下一页数据
            const nextPageParams = {
              ...searchParams,
              page: searchParams.page + 1,
            };

            const response = await musicApi.search(nextPageParams);

            if (response.code !== 0 || !response.data) {
              throw new Error("加载更多失败");
            }

            // 根据搜索类型处理不同的数据合并
            let updatedResult: SearchResult;

            if (response.data.type === "song" && searchResult.type === "song") {
              // 歌曲搜索：检查是否有重复歌曲
              const existingSongs = searchResult.songs;
              const existingIds = new Set(existingSongs.map((song) => song.id));
              const newSongs = response.data.songs.filter(
                (song) => !existingIds.has(song.id)
              );

              updatedResult = {
                type: "song",
                songs: [...existingSongs, ...newSongs],
                total: response.data.total,
                hasMore: response.data.hasMore,
              };

              console.log("[加载更多] 歌曲搜索状态更新:", {
                原有歌曲数: existingSongs.length,
                新增歌曲数: newSongs.length,
                后端返回total: response.data.total,
                hasMore: response.data.hasMore,
              });
            } else if (
              response.data.type === "album" &&
              searchResult.type === "album"
            ) {
              // 专辑搜索：检查是否有重复专辑
              const existingAlbums = searchResult.albums;
              const existingIds = new Set(
                existingAlbums.map((album) => album.id)
              );
              const newAlbums = response.data.albums.filter(
                (album) => !existingIds.has(album.id)
              );

              updatedResult = {
                type: "album",
                albums: [...existingAlbums, ...newAlbums],
                total: response.data.total,
                hasMore: response.data.hasMore,
              };

              console.log("[加载更多] 专辑搜索状态更新:", {
                原有专辑数: existingAlbums.length,
                新增专辑数: newAlbums.length,
                后端返回total: response.data.total,
                hasMore: response.data.hasMore,
              });
            } else if (
              response.data.type === "playlist" &&
              searchResult.type === "playlist"
            ) {
              // 歌单搜索：检查是否有重复歌单
              const existingPlaylists = searchResult.playlists;
              const existingIds = new Set(
                existingPlaylists.map((playlist) => playlist.id)
              );
              const newPlaylists = response.data.playlists.filter(
                (playlist) => !existingIds.has(playlist.id)
              );

              updatedResult = {
                type: "playlist",
                playlists: [...existingPlaylists, ...newPlaylists],
                total: response.data.total,
                hasMore: response.data.hasMore,
              };

              console.log("[加载更多] 歌单搜索状态更新:", {
                原有歌单数: existingPlaylists.length,
                新增歌单数: newPlaylists.length,
                后端返回total: response.data.total,
                hasMore: response.data.hasMore,
              });
            } else {
              throw new Error("搜索类型不匹配");
            }

            set({
              searchResult: updatedResult,
              searchParams: nextPageParams,
              page: nextPageParams.page,
              isLoadingMore: false,
            });
          } catch (error) {
            console.error("加载更多失败:", error);
            set({ isLoadingMore: false });
            toast.error(
              `加载更多失败: ${
                error instanceof Error ? error.message : "未知错误"
              }`
            );
          }
        },

        // 重置搜索状态
        reset: () =>
          set({
            searchParams: {
              key: "",
              page: 1,
              pageSize: 20,
              type: "song",
              cookie_id: "",
            },
            searchResult: null,
            page: 1,
            pageSize: 20,
            isLoading: false,
            isLoadingMore: false,
            isError: false,
            error: null,
          }),

        // 清除缓存
        clearCache: () => set({ cache: {} }),
      };
    },
    {
      name: "search-store",
      partialize: (state) => ({
        cache: state.cache,
        playlistDetailCache: state.playlistDetailCache,
        searchParams: state.searchParams,
      }),
    }
  )
);

// 为了向后兼容，提供便利的导出
export const useSearchResults = () => {
  const store = useSearchStore();
  return {
    songs: store.getSongs(),
    albums: store.getAlbums(),
    playlists: store.getPlaylists(),
    total: store.getTotal(),
    hasMore: store.getHasMore(),
    isLoading: store.isLoading,
    isLoadingMore: store.isLoadingMore,
    isError: store.isError,
    error: store.error,
    searchType: store.searchParams.type,
  };
};
