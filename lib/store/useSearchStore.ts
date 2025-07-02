import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Song,
  SearchParams,
  SearchResult,
  AlbumSearchItem,
  PlaylistSearchItem,
  SearchResponse,
} from "../api/types";
import musicApi from "../api/client";
import { toast } from "sonner";
import { debounce } from "../utils";
import { withErrorHandling } from "@/lib/utils/error";

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

        toast.success(`正在搜索"${state.searchParams.key}"`, {
          description: `类型：${
            state.searchParams.type === "song"
              ? "歌曲"
              : state.searchParams.type === "album"
              ? "专辑"
              : "歌单"
          }`,
        });

        await withErrorHandling<SearchResponse>({
          apiCall: () => musicApi.search(state.searchParams),
          onSuccess: (response) => {
            if (!response || response.code !== 0 || !response.data) {
              const errorMessage =
                response?.message || `搜索失败，错误码: ${response?.code}`;
              // 对于业务逻辑上的失败，我们手动触发onError的行为
              toast.error("搜索失败", { description: errorMessage });
              set({
                isLoading: false,
                isError: true,
                error: errorMessage,
                searchResult: null,
              });
              return;
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

              const newPlaylistDetailCache = { ...state.playlistDetailCache };
              if (response.data.type === "playlist") {
                response.data.playlists.forEach(
                  (playlist: PlaylistSearchItem) => {
                    newPlaylistDetailCache[playlist.id.toString()] = {
                      playlist,
                      timestamp: now,
                    };
                  }
                );
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
              const playlistCacheEntries = Object.entries(
                newPlaylistDetailCache
              );
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

            set({
              searchResult: response.data,
              isLoading: false,
            });

            const hasResults =
              (response.data.type === "song" &&
                response.data.songs.length > 0) ||
              (response.data.type === "album" &&
                response.data.albums.length > 0) ||
              (response.data.type === "playlist" &&
                response.data.playlists.length > 0);

            if (!hasResults) {
              toast.info(`未找到与"${state.searchParams.key}"相关的结果`);
            }
          },
          onError: (error: Error) => {
            set({
              isLoading: false,
              isError: true,
              error: error.message,
              searchResult: null,
            });
          },
          errorMessage: "搜索失败",
        });
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

          const nextPageParams = {
            ...searchParams,
            page: searchParams.page + 1,
          };

          await withErrorHandling<SearchResponse>({
            apiCall: () => musicApi.search(nextPageParams),
            onSuccess: (response) => {
              if (response.code !== 0 || !response.data) {
                // withErrorHandling 已经处理了 toast，这里只处理状态
                set({ isLoadingMore: false });
                return;
              }

              let updatedResult: SearchResult;
              if (
                response.data.type === "song" &&
                searchResult.type === "song"
              ) {
                const existingSongs = searchResult.songs;
                const existingIds = new Set(
                  existingSongs.map((song: Song) => song.id)
                );
                const newSongs = response.data.songs.filter(
                  (song: Song) => !existingIds.has(song.id)
                );
                updatedResult = {
                  type: "song",
                  songs: [...existingSongs, ...newSongs],
                  total: response.data.total,
                  hasMore: response.data.hasMore,
                };
              } else if (
                response.data.type === "album" &&
                searchResult.type === "album"
              ) {
                const existingAlbums = searchResult.albums;
                const existingIds = new Set(
                  existingAlbums.map((album: AlbumSearchItem) => album.id)
                );
                const newAlbums = response.data.albums.filter(
                  (album: AlbumSearchItem) => !existingIds.has(album.id)
                );
                updatedResult = {
                  type: "album",
                  albums: [...existingAlbums, ...newAlbums],
                  total: response.data.total,
                  hasMore: response.data.hasMore,
                };
              } else if (
                response.data.type === "playlist" &&
                searchResult.type === "playlist"
              ) {
                const existingPlaylists = searchResult.playlists;
                const existingIds = new Set(
                  existingPlaylists.map(
                    (playlist: PlaylistSearchItem) => playlist.id
                  )
                );
                const newPlaylists = response.data.playlists.filter(
                  (playlist: PlaylistSearchItem) =>
                    !existingIds.has(playlist.id)
                );
                updatedResult = {
                  type: "playlist",
                  playlists: [...existingPlaylists, ...newPlaylists],
                  total: response.data.total,
                  hasMore: response.data.hasMore,
                };
              } else {
                set({ isLoadingMore: false });
                return;
              }

              set({
                searchResult: updatedResult,
                searchParams: nextPageParams,
                page: nextPageParams.page,
                isLoadingMore: false,
              });
            },
            onError: () => {
              set({ isLoadingMore: false });
            },
            errorMessage: "加载更多失败",
          });
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
