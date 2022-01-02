//#region Imports
	import { Readable } from "stream";
	import axios, { AxiosError, AxiosResponse } from "axios";	
	import { M2D_LogUtils } from "./log";
	import { M2D_ErrorSubtypes } from "./utils";
	import { M2D_EErrorTypes, M2D_EGeneralErrorSubtypes, M2D_GeneralUtils, M2D_IError, M2D_IUnknownError } from "./utils";
	import ytdl from "ytdl-core-discord";
//#endregion

//#region Types
	interface M2D_IYTAPIVideoMetadata {
		videoId: string;
		title: string;
		author: string;
		thumbnailUrl: string;
	};
	//#region Error types
		const enum M2D_EYTAPIErrorSubtypes {
			YouTubeAPI = "YOUTUBE_API",
			MetadataNotCached = "METADATA_NOT_CACHED",
			QuotaExceeded = "QUOTA_EXCEEDED",
			WrongURL = "WRONG_URL"
		};
		interface M2D_IYTAPIYoutubeAPIError extends M2D_IError {
			data: {
				videoId: string;
				errorMessage: string;
			}
		};
		interface M2D_IYTAPIMetadataNotCachedError extends M2D_IError {
			data: {
				videoId: string;
			}
		};
		interface M2D_IYTAPIQuotaExceededError extends M2D_IError {
			data: Record<string, never>;
		};
		interface M2D_IYTAPIWrongUrlError extends M2D_IError {
			data: {
				url: string;
			}
		};

		type M2D_YTAPIError = M2D_IYTAPIYoutubeAPIError |
			M2D_IYTAPIMetadataNotCachedError |
			M2D_IYTAPIQuotaExceededError |
			M2D_IYTAPIWrongUrlError;
	//#endregion
//#endregion

let M2D_YT_API_KEY = "";
let M2D_CURRENT_QUOTA = 0;
const M2D_CACHED_METADATA: M2D_IYTAPIVideoMetadata[] = [];
const YT_URL_REGEX = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/;

const M2D_YTAPIUtils = {
	getVideoMetadata: (videoId: string) => new Promise<M2D_IYTAPIVideoMetadata>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano pobranie metadanych wideo o ID "${videoId}"...`)
			.then(() => M2D_YTAPIUtils.getVideoMetadataFromCache(videoId))
			.then((metadata) => M2D_LogUtils.logMessage(`success`, `Uzyskano metadane wideo o ID "${videoId}"`)
				.then(() => res(metadata))
			)
			.catch(() => M2D_LogUtils.logMessage(`warn`, `Nie udało się uzyskać metadanych wideo o ID "${videoId}" z cache'u. Pobieranie metadanych z API...`))
			.then(() => M2D_YTAPIUtils.getVideoMetadataFromAPI(videoId))
			.then((metadata) => M2D_LogUtils.logMessage(`success`, `Uzyskano metadane wideo o ID "${videoId}"`)
				.then(() => res(metadata)))
			.catch((err) => M2D_LogUtils.logMessage(`error`, `Nie udało się uzyskać metadanych wideo o ID "${videoId}"!`)
				.then(() => rej(err))
			);
	}),
	getVideoMetadataFromCache: (videoId: string) => new Promise<M2D_IYTAPIVideoMetadata>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano pobranie metadanych wideo o ID "${videoId}" z cache'u...`)
			.then(() => {
				if(M2D_YTAPIUtils.doesVideoMetadataExistInCache(videoId)) {
					M2D_LogUtils.logMessage(`success`, `Znaleziono metadane wideo o ID "${videoId}" w cache'u!`)
						.then(() => res(M2D_CACHED_METADATA.find((v) => v.videoId === videoId) as M2D_IYTAPIVideoMetadata));	
				} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono metadanych wideo o ID "${videoId}" w cache'u.`)
					.then(() => rej({
						type: M2D_EErrorTypes.YTAPI,
						subtype: M2D_EYTAPIErrorSubtypes.YouTubeAPI,
						data: {
							videoId
						}
					} as M2D_IYTAPIMetadataNotCachedError));
			});
	}),
	doesVideoMetadataExistInCache: (videoId: string) => M2D_CACHED_METADATA.find((v) => v.videoId === videoId) !== undefined,
	getVideoMetadataFromAPI: (videoId: string) => new Promise<M2D_IYTAPIVideoMetadata>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano pobranie metadanych wideo o ID "${videoId}" z API YouTube'a...`)
			.then(() => {
				if(M2D_CURRENT_QUOTA < 10000) {
					M2D_LogUtils.logMessage(`info`, `Wysyłanie zapytania do API YouTube'a...`)
						.then(() => axios.get(`https://youtube.googleapis.com/youtube/v3/videos`, {
							headers: {
								Accept: "application/json"
							},
							params: {
								part: "snippet",
								id: videoId,
								key: M2D_YT_API_KEY
							},
							responseType: "json"
						}))
						.then((resp) => M2D_LogUtils.logMessage(`success`, `Uzyskano metadane wideo o ID "${videoId}" z API YouTube'a!`)
							.then(() => {
								const metadata: M2D_IYTAPIVideoMetadata = {
									videoId,
									title: resp.data.items[0].snippet.title,
									author: resp.data.items[0].snippet.channelTitle,
									thumbnailUrl: resp.data.items[0].snippet.thumbnails.default.url
								};

								if(!M2D_YTAPIUtils.doesVideoMetadataExistInCache(videoId)) {
									M2D_CACHED_METADATA.push(metadata);
								}
								M2D_CURRENT_QUOTA++;
								res(metadata);
							})
						)
						.catch((err: AxiosError) => {
							if(err.response) {
								M2D_LogUtils.logMultipleMessages(`error`, [`Wysyłanie żądania do API YouTube'a powiodło się, lecz zwrócono błąd!`, `Zwrócony wynik: "${JSON.stringify(err.response.data)}"`, `Treść błędu Axios: "${err.message}"`])
									.then(() => rej({
										type: M2D_EErrorTypes.YTAPI,
										subtype: M2D_EYTAPIErrorSubtypes.YouTubeAPI,
										data: {
											videoId,
											errorMessage: (err.response as AxiosResponse).data.message
										}
									} as M2D_IYTAPIYoutubeAPIError))
							} else {
								M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas wysyłania żądania do API YouTube'a`, `Treść błędu: "${err.message}"`])
									.then(() => rej({
										type: M2D_EErrorTypes.YTAPI,
										subtype: M2D_EYTAPIErrorSubtypes.YouTubeAPI,
										data: {
											videoId,
											errorMessage: err.message
										}
									} as M2D_IYTAPIYoutubeAPIError));
							}
						});
				} else M2D_LogUtils.logMessage(`error`, `Przekroczono dozwolony przez Google dzienny limit zapytań`)
					.then(() => rej({
						type: M2D_EErrorTypes.YTAPI,
						subtype: M2D_EYTAPIErrorSubtypes.QuotaExceeded,
						data: {}
					} as M2D_IYTAPIQuotaExceededError));
			});
	}),
	getVideoStream: (url: string) => new Promise<Readable>((res, rej) => {
		if(M2D_YTAPIUtils.isUrlParsable(url)) {
			M2D_LogUtils.logMessage(`info`, `Pobieranie strumienia audio wideo o URL "${url}" poprzez ytdl...`)
				.then(() => ytdl(url, {
					quality: "highestaudio"
				}))
				.then((stream: Readable) => M2D_LogUtils.logMessage(`success`, `Uzyskano strumien audio wideo o URL "${url}"!`)
						.then(() => stream)
				)
				.then((stream: Readable) => res(stream))
				.catch(() => M2D_LogUtils.logMessage(`error`, `Wystąpił błąd podczas pobierania strumienia audio!`))
				.then(() => rej({
					type: M2D_EErrorTypes.YTAPI,
					subtype: "UNKNOWN",
					data: {
						errorData: null
					}
				} as M2D_IUnknownError));
		} else rej({
			type: M2D_EErrorTypes.YTAPI,
			subtype: M2D_EYTAPIErrorSubtypes.WrongURL,
			data: {
				url
			}
		} as M2D_IYTAPIWrongUrlError)
	}),
	isUrlParsable: (url: string) => YT_URL_REGEX.test(url),
	parseUrl: (url: string) => new Promise<string>((res, rej) => {
		if(M2D_YTAPIUtils.isUrlParsable(url)) {
			res((YT_URL_REGEX.exec(url) as RegExpExecArray)[1]);
		} else rej({
			type: M2D_EErrorTypes.YTAPI,
			subtype: M2D_EYTAPIErrorSubtypes.WrongURL,
			data: {
				url
			}
		} as M2D_IYTAPIWrongUrlError);
	}),
	initYTAPICapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie możliwości związanych z API YouTube'a`)
			.then(() => M2D_GeneralUtils.getEnvVar("YT_API_KEY")
				.then((val: string) => { M2D_YT_API_KEY = val; })
			)
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano możliwości związane z API YouTube'a!`)
				.then(() => res())
			)
			.catch((err) => rej(err));
	}),
	YTAPIExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie możliwości związanych z API YouTube'a`)
			.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono możliwości związane z API YouTube'a!`)
				.then(() => res())
			);
	})
};

//#region Exports
	export type {
		M2D_IYTAPIVideoMetadata,
		M2D_IYTAPIYoutubeAPIError,
		M2D_IYTAPIMetadataNotCachedError,
		M2D_IYTAPIQuotaExceededError,
		M2D_IYTAPIWrongUrlError,
		M2D_YTAPIError
	};
	export {
		M2D_YTAPIUtils,
		M2D_EYTAPIErrorSubtypes
	}
//#endregion