//#region Imports
	import { M2D_LogUtils } from "./log";
	import { M2D_GeneralUtils, M2D_IGeneralNoEnvVariableError, M2D_IError, M2D_EErrorTypes } from "./utils";
	import * as fs from "fs/promises";
//#endregion

//#region Types
	interface M2D_IConfigGuildEntry {
		guildId: string;
		value: string;
	};
	interface M2D_IConfigEntry {
		name: string;
		label: string;
		description: string;
		value: string;
		overridable: boolean;
		overrideOnly: boolean;
		guildOverrides: M2D_IConfigGuildEntry[];
	}
	//#region Error types
		const enum M2D_EConfigErrorSubtypes {
			Filesystem = "FILESYSTEM",
			MissingKey = "MISSING_KEY",
			KeyNotOverridable = "KEY_NOT_OVERRIDABLE",
			KeyOverrideOnly = "KEY_OVERRIDE_ONLY",
			OverrideNotPresent = "OVERRIDE_NOT_PRESENT"
		};
		interface M2D_IConfigFilesystemError extends M2D_IError {
			data: {
				errorMessage: string;
				path: string;
			}
		};
		interface M2D_IConfigMissingKeyError extends M2D_IError {
			data: {
				key: string;
			}
		};
		interface M2D_IConfigKeyNotOverridableError extends M2D_IError {
			data: {
				key: string;
			}
		};
		interface M2D_IConfigOverrideNotPresentError extends M2D_IError {
			data: {
				key: string;
				guildId: string;
			}
		}
		interface M2D_IConfigKeyOverrideOnlyError extends M2D_IError {
			data: {
				key: string;
			}
		}
	//#endregion
//#endregion

//#region Variables
	let M2D_ConfigFileLocation = "m2d_config.json";
	let M2D_CONFIG: M2D_IConfigEntry[] = [];
//#endregion

const M2D_ConfigUtils = {
	getConfigValue: (key: string, guildId?: string) => new Promise<string>((res, rej) => {
		if(guildId) {
			M2D_ConfigUtils.getConfigOverrideValue(guildId, key)
				.then((val) => res(val))
				.catch((err) => {
					if(err.subtype === M2D_EConfigErrorSubtypes.MissingKey) {
						rej(err as M2D_IConfigMissingKeyError);
					} else return M2D_ConfigUtils.getGlobalConfigValue(key)
						.then((val) => res(val))
						.catch((err) => rej(err));
				});
		} else {
			M2D_ConfigUtils.getGlobalConfigValue(key)
				.then((val) => res(val))
				.catch((err) => rej(err));
		}
	}),
	setConfigOverride: (guildId: string, key: string, value: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości zastępującej dla wartości konfiguracyjnej o kluczu "${key}" na serwerze o ID "${guildId}"...`)
		const configEntry: M2D_IConfigEntry | undefined = M2D_CONFIG.find((v) => v.name === key || v.label === key);

		if(configEntry) {
			M2D_LogUtils.logMessage("info", `Znaleziono wartość konfiguracyjną o kluczu "${key}"! Szukanie wartości zastępującej...`)
				.then(() => {
					if(configEntry.overridable) {
						const configGuildOverrideEntry: M2D_IConfigGuildEntry | undefined = configEntry.guildOverrides.find((v) => v.guildId === guildId);

						if(configGuildOverrideEntry) {
							const cEIDX = M2D_CONFIG.indexOf(configEntry);
							const cGOIDX = configEntry.guildOverrides.indexOf(configGuildOverrideEntry);

							M2D_CONFIG[cEIDX].guildOverrides[cGOIDX].value = value;
							M2D_LogUtils.logMessage(`success`, `Pomyślnie zmieniono wartość wartości zastępującej wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}" na "${value}"!`)
								.then(() => res());
						} else {
							const cEIDX = M2D_CONFIG.indexOf(configEntry);

							M2D_CONFIG[cEIDX].guildOverrides.push({
								guildId,
								value
							});
							M2D_LogUtils.logMessage(`success`, `Pomyślnie zmieniono wartość wartości zastępującej wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}" na "${value}"!`)
								.then(() => res());
						}
					} else {
						M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" jest niezastępywalna!`)
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
								data: {
									key
								}
							} as M2D_IConfigKeyNotOverridableError));
					}
				});
		} else { 
			M2D_LogUtils.logMessage("error", `Próbowano uzyskać dostęp do wartości konfiguracyjnej o kluczu "${key}", lecz wartość taka nie istnieje!`)
				.then(() => 
					rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: {
							key
						}
					} as M2D_IConfigMissingKeyError)
				);
		}

	}),
	getGlobalConfigValue: (key: string) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości konfiguracyjnej o kluczu "${key}"...`)
		const configEntry: M2D_IConfigEntry | undefined = M2D_CONFIG.find((v) => v.name === key || v.label === key);

		if(configEntry) {
			M2D_LogUtils.logMessage("info", `Znaleziono wartość konfiguracyjną o kluczu "${key}"!`)
				.then(() => {
					if(!configEntry.overrideOnly) {
						res(configEntry.value);
					} else {
						M2D_LogUtils.logMessage("error", `Próbowano odczytać wartość konfiguracyjną o kluczu "${key}", lecz wartość ta jest tylko zastępowywalna!`)
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.KeyOverrideOnly,
								data: {
									key
								}
							} as M2D_IConfigKeyOverrideOnlyError));
					}
				});
		} else { 
			M2D_LogUtils.logMessage("error", `Próbowano uzyskać dostęp do wartości konfiguracyjnej o kluczu "${key}", lecz wartość taka nie istnieje!`)
				.then(() => 
					rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: {
							key
						}
					} as M2D_IConfigMissingKeyError)
				);
		}
	}),
	getConfigOverrideValue: (guildId: string, key: string) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości zastępującej dla wartości konfiguracyjnej o kluczu "${key}" na serwerze o ID "${guildId}"...`)
		const configEntry: M2D_IConfigEntry | undefined = M2D_CONFIG.find((v) => v.name === key || v.label === key);

		if(configEntry) {
			M2D_LogUtils.logMessage("info", `Znaleziono wartość konfiguracyjną o kluczu "${key}"! Szukanie wartości zastępującej...`)
				.then(() => {
					if(configEntry.overridable) {
						const configGuildOverrideEntry: M2D_IConfigGuildEntry | undefined = configEntry.guildOverrides.find((v) => v.guildId === guildId);

						if(configGuildOverrideEntry) {
							M2D_LogUtils.logMessage("success", `Znaleziono wartość zastępującą wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}"!`)
								.then(() => res(configGuildOverrideEntry.value));
						} else {
							M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" nie posiada wartości zastępującej dla serwera o ID "${guildId}"!`)
								.then(() => rej({
									type: M2D_EErrorTypes.Config,
									subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
									data: {
										key,
										guildId
									}
								} as M2D_IConfigOverrideNotPresentError));
						}
					} else {
						M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" jest niezastępywalna!`)
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
								data: {
									key
								}
							} as M2D_IConfigKeyNotOverridableError));
					}
				});
		} else { 
			M2D_LogUtils.logMessage("error", `Próbowano uzyskać dostęp do wartości konfiguracyjnej o kluczu "${key}", lecz wartość taka nie istnieje!`)
				.then(() => 
					rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: {
							key
						}
					} as M2D_IConfigMissingKeyError)
				);
		}
	}),
	initConfigCapabilities: () => new Promise<void>((res, rej) => {
		M2D_GeneralUtils.getEnvVar("CONFIG_FILE")
			.then((getEnvVar_retData) => M2D_LogUtils.logMessage("info", `Znaleziono zmienną środowiskową "M2D_CONFIG_FILE" - stosowanie się do jej wartości...`)
				.then(() => {
					M2D_ConfigFileLocation = getEnvVar_retData;
				})
			)
			.catch((getEnvVar_errData: M2D_IGeneralNoEnvVariableError) => M2D_LogUtils.logMessage("warn", `Nie znaleziono zmiennej środowiskowej "M2D_CONFIG_FILE" - stosowanie domyślnej wartości...`))
			.finally(() => {
				fs.readFile(M2D_ConfigFileLocation, {
					encoding: "utf-8",
					flag: "r"
				})
					.then((data: string) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano plik konfiguracyjny!")
						.then(() => {
							M2D_CONFIG = JSON.parse(data);
							res();
						}))
					.catch(err => M2D_LogUtils.logMessage("warn", "Nie udało się wczytać pliku konfiguracyjnego - wczytywanie domyślnej konfiguracji...")
						.then(() => {
							fs.readFile("m2d_defaultconfig.json", {
								encoding: "utf-8",
								flag: "r"
							})
								.then((data) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano domyślną konfigurację!")
									.then(() => {
										M2D_CONFIG = JSON.parse(data);
										res();
									}))
								.catch((err) => M2D_LogUtils.logMessage("error", "Nie udało się wczytać domyślnej konfiguracji!")
									.then(() => {
										rej({
											type: M2D_EErrorTypes.Config,
											subtype: M2D_EConfigErrorSubtypes.Filesystem,
											data: {
												errorMessage: err.message,
												path: "m2d_defaultconfig.json"
											}
										} as M2D_IConfigFilesystemError);
									}));
						}));
			});
	})
};

//#region Exports
	export type {
		M2D_IConfigEntry,
		M2D_IConfigGuildEntry,
		M2D_IConfigFilesystemError,
		M2D_IConfigMissingKeyError,
		M2D_IConfigKeyNotOverridableError
	}
	export {
		M2D_EConfigErrorSubtypes,
		M2D_ConfigUtils
	}
//#endregion