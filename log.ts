//#region Imports
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError, M2D_IGeneralNoEnvVariableError } from "./utils";
	import * as fs from "fs/promises";
	import * as path from "path";
import { readJsonConfigFile } from "typescript";
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
	//#endregion
//#endregion

//#region Variables
	let M2D_LogFileLocation = `m2d.log`;
//#endregion

const M2D_LogUtils = {
	logMessage: (type: M2D_LogMessageType, message: string) => new Promise<void>((res, rej) => {
		const timestamp = (new Date()).toISOString();
		const outputMessage = `[ ${type.toUpperCase()} ] | ${timestamp} |\t${message}`;

		fs.appendFile(M2D_LogFileLocation, `${outputMessage}\n`)
			.catch((err) => {
				console.error(`Message was not logged to log file! Error: "${err.message}"`);
			})
			.finally(() => {
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
				res();
			});
	}),
	logMultipleMessages: (type: M2D_LogMessageType, ...messages: string[]) => new Promise<void>((res, rej) => {
		const timestamp = (new Date()).toISOString();
		const outputMessages = messages.map((v) => `[ ${type.toUpperCase()} ] | ${timestamp} |\t${v}${(messages.indexOf(v) !== (messages.length - 1)) ? "\n" : ""}`);

		fs.appendFile(M2D_LogFileLocation, `${outputMessages.join("")}\n`)
			.catch((err) => {
				console.error(`Message was not logged to log file! Error: "${err.message}"`);
			})
			.finally(() => {
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
				res();
			});

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
				fs.access(M2D_LogFileLocation)
					.then(() => M2D_LogUtils.logMessage("success", "Zainicjalizowano logi!")
						.then(() => res())
						.catch((logMessage_errData) => rej(logMessage_errData))
					)
					.catch((err) => rej({
						type: M2D_EErrorTypes.Log,
						subtype: M2D_ELogErrorSubtypes.Filesystem,
						data: {
							errorMessage: err.message,
							path: M2D_LogFileLocation
						}
					} as M2D_ILogFilesystemError));
			});
	})
};

//#region Exports
	export type {
		M2D_LogMessageType,
		M2D_ILogFilesystemError
	};
	export {
		M2D_LogUtils,
		M2D_ELogErrorSubtypes
	};
//#endregion