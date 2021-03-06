//#region Imports
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError, M2D_IGeneralNoEnvVariableError } from "./utils";
	import * as fs from "fs/promises";
	import * as path from "path";
//#endregion

//#region Types
	type M2D_LogMessageType = "info" | "success" | "warn" | "error";
	//#region Error types
		const enum M2D_ELogErrorSubtypes {
			Filesystem = "FILESYSTEM"
		};
		interface M2D_ILogFilesystemError extends M2D_IError{
			data: {
				errorMessage: string;
				path: string;
			};
		};

		type M2D_LogError = M2D_ILogFilesystemError;
	//#endregion
//#endregionZapisywanie
//#region Variables
	let M2D_LogFileLocation = `m2d.log`;
	const M2D_LogStartingMessage = `======\nMuzyk2D - v${M2D_GeneralUtils.getMuzyk2DVersion()}\nby Marcin "Mikut" Mikuła\nMikut 2020-2022\n======\n\n`;
	let M2D_LoggingToFileInternalSwitch = true;
	let M2D_SaveLogsToFile = true;
//#endregion

const M2D_LogUtils = {
	logMessage: (type: M2D_LogMessageType, message: string, logToConsole = true, logToFile = true) => new Promise<void>((res, rej) => {
		const timestamp = (new Date()).toISOString();
		const outputMessage = `${type.toUpperCase()} | ${timestamp} | ${message}`;

		if(M2D_LoggingToFileInternalSwitch && (logToFile && M2D_SaveLogsToFile)) {
			fs.appendFile(M2D_LogFileLocation, `${outputMessage}\n`)
				.catch((err) => {
					console.error(`Message was not logged to log file! Error: "${err.message}"`);
				})
				.finally(() => {
					switch(type) {
						case "error":
							if(logToConsole) console.error(outputMessage);
						break;
						case "info":
							if(logToConsole) console.info(outputMessage);
						break;
						case "success":
							if(logToConsole) console.log(outputMessage);
						break;
						case "warn":
							if(logToConsole) console.warn(outputMessage);
						break;
					}
					res();
				});
		} else {
			if(logToConsole) {
					switch(type) {
						case "error":
							console.error(outputMessage);
						break;
						case "info":
							console.info(outputMessage);
						break;
						case "success":
							console.log(outputMessage);
						break;
						case "warn":
							console.warn(outputMessage);
						break;
					}
			}
			res();
		}
	}),
	logMultipleMessages: (type: M2D_LogMessageType, messages: string[], logToConsole = true, logToFile = true) => new Promise<void>((res, rej) => {
		const timestamp = (new Date()).toISOString();
		const outputMessages = messages.map((v) => `${type.toUpperCase()} | ${timestamp} | ${v}${(messages.indexOf(v) !== (messages.length - 1)) ? "\n" : ""}`);

		if(M2D_LoggingToFileInternalSwitch && (logToFile && M2D_SaveLogsToFile)) {
			fs.appendFile(M2D_LogFileLocation, `${outputMessages.join("")}\n`)
				.catch((err) => {
					console.error(`Message was not logged to log file! Error: "${err.message}"`);
				})
				.finally(() => {
					switch(type) {
						case "error":
							if(logToConsole) console.error(outputMessages.join(""));
						break;
						case "info":
							if(logToConsole) console.info(outputMessages.join(""));
						break;
						case "success":
							if(logToConsole) console.log(outputMessages.join(""));
						break;
						case "warn":
							if(logToConsole) console.warn(outputMessages.join(""));
						break;
					}
					res();
				});
		} else {
			if(logToConsole) {
				switch(type) {
					case "error":
						console.error(outputMessages.join(""));
					break;
					case "info":
						console.info(outputMessages.join(""));
					break;
					case "success":
						console.log(outputMessages.join(""));
					break;
					case "warn":
						console.warn(outputMessages.join(""));
					break;
				}
			}
			res();
		}

	}),
	leaveTrailingNewline: () => new Promise<void>((res, rej) => {
		fs.appendFile(M2D_LogFileLocation, `\n`, {encoding: "utf-8"})
			.then(() => res())
			.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [`Nie udało się zostawić znaku nowej linii na końcu pliku "${M2D_LogFileLocation}"`, `Treść błędu: "${err.message}"`])
				.then(() => rej({
					type: M2D_EErrorTypes.Log,
					subtype: M2D_ELogErrorSubtypes.Filesystem,
					data: {
						errorMessage: err.message,
						path: M2D_LogFileLocation
					}
				} as M2D_ILogFilesystemError))
			);
	}),
	initLogCapabilities: () => new Promise<void>((res, rej) => {
		console.log(`Rozpoczęto inicjalizację logów...`);
		M2D_GeneralUtils.getEnvVar("LOG_FILE")
			.then((getEnvVar_retData) => {
				console.log(`Znaleziono zmienną środowiskową M2D_LOG_FILE - stosowanie się do jej ustawień...`);
				M2D_LogFileLocation = getEnvVar_retData;
			})
			.catch((getEnvVar_errData: M2D_IGeneralNoEnvVariableError) => {
				console.log(`Nie znaleziono zmiennej środowiskowej M2D_LOG_FILE - ustawianie domyślnej wartości ("${M2D_LogFileLocation}")...`);
			})
			.finally(() => {
				fs.appendFile(M2D_LogFileLocation, M2D_LogStartingMessage, { encoding: "utf-8" })
					.then(() => M2D_LogUtils.logMessage("success", "Zainicjalizowano logi!")
						.then(() => res())
					)
					.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [`Nie udało się dopisać startowej wiadomości do pliku "${M2D_LogFileLocation}"!`, `Treść błędu: "${err.message}"`, `Błąd ten nie wpływa na dalsze działanie programu.`])
						.then(() => res())
					);
			});
	}),
	logExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie logów... Od tego momentu logi nie będą zapisywane do pliku.`)
			.then(() => { 
					M2D_LoggingToFileInternalSwitch = false;
					M2D_LogUtils.leaveTrailingNewline()
						.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono logi!`, true, false)
							.then(() => res())
						)
						.catch((err) => rej(err));
			});
	})
};

//#region Exports
	export type {
		M2D_LogMessageType,
		M2D_ILogFilesystemError,
		M2D_LogError
	};
	export {
		M2D_LogUtils,
		M2D_ELogErrorSubtypes
	};
//#endregion