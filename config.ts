//#region Imports
	import { M2D_LogUtils } from "./log";
	import { M2D_GeneralUtils, M2D_IGeneralNoEnvVariableError, M2D_IError, M2D_EErrorTypes, M2D_Error } from "./utils";
	import { M2D_CommandUtils, M2D_ICommand, M2D_ICommandParameter, M2D_ICommandParameterDesc, M2D_ICommandSuppParameters, M2D_CATEGORIES, M2D_ECommandsErrorSubtypes, M2D_ICommandsMissingSuppParametersError } from "./commands";
	import { M2D_MessagesUtils } from "./messages";
	import { M2D_ClientUtils } from "./client";
	import * as fs from "fs/promises";
import { config } from "dotenv";
import { getSupportedCodeFixes } from "typescript";
import { PartialTextBasedChannel } from "discord.js";
//#endregion

//#region Types
	interface M2D_IConfigGuildEntry {
		guildId: string;
		value: string;
	};
	interface M2D_IConfigSchemeEntry {
		name: string;
		label: string;
		description: string;
		overridable: boolean;
		overrideOnly: boolean;
	}
	interface M2D_IConfigEntry {
		name: string;
		value: string;
		guildOverrides: M2D_IConfigGuildEntry[];
	}
	//#region Error types
		const enum M2D_EConfigErrorSubtypes {
			Filesystem = "FILESYSTEM",
			MissingKey = "MISSING_KEY",
			MissingLabel = "MISSING_LABEL",
			KeyNotOverridable = "KEY_NOT_OVERRIDABLE",
			KeyOverrideOnly = "KEY_OVERRIDE_ONLY",
			OverrideNotPresent = "OVERRIDE_NOT_PRESENT",
			ConfigSchemeMismatch = "CONFIG_SCHEME_MISMATCH",
			NoDefaultConfig = "NO_DEFAULT_CONFIG"
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
		interface M2D_IConfigMissingLabelError extends M2D_IError {
			data: {
				label: string;
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
		};
		interface M2D_IConfigKeyOverrideOnlyError extends M2D_IError {
			data: {
				key: string;
			}
		};
		interface M2D_IConfigConfigSchemeMismatchError extends M2D_IError {
			data: {
				excessiveKeys: string[];
				missingKeys: string[]
			};
		};
		interface M2D_IConfigNoDefaultConfigError extends M2D_IError {
			data: Record<string, never>;
		}

		type M2D_ConfigError = M2D_IConfigFilesystemError |
			M2D_IConfigMissingKeyError |
			M2D_IConfigMissingLabelError |
			M2D_IConfigKeyNotOverridableError |
			M2D_IConfigConfigSchemeMismatchError |
			M2D_IConfigNoDefaultConfigError;
	//#endregion
//#endregion

//#region Variables
	let M2D_ConfigFileLocation = "m2d_config.json";
	let M2D_CONFIG_SCHEME: M2D_IConfigSchemeEntry[] = [];
	let M2D_CONFIG: M2D_IConfigEntry[] = [];
	let M2D_DEFAULT_CONFIG: M2D_IConfigEntry[] = [];
//#endregion

const M2D_ConfigUtils = {
	isConfigValueSet: (key: string) => new Promise<boolean>((res, rej) => {
		M2D_ConfigUtils.getConfigValue(key)
			.then((val) => res(val.length > 0))
			.catch((err) => rej(err));
	}),
	isConfigValueOverrideSet: (guildId: string, key: string) => new Promise<boolean>((res, rej) => {
		M2D_ConfigUtils.getConfigOverrideValue(guildId, key)
			.then((val) => res(val.length > 0))
			.catch((err) => rej(err));	
	}),
	isConfigEntryKeyInScheme: (key: string): boolean => M2D_CONFIG_SCHEME.find((v) => v.name === key) !== undefined,
	isConfigEntryLabelInScheme: (label: string): boolean => M2D_CONFIG_SCHEME.find((v) => v.label === label) !== undefined,
	isConfigEntryOverridable: (key: string): boolean => {
		const configSchemeEntry = M2D_CONFIG_SCHEME.find((v) => v.name === key);

		if(configSchemeEntry) {
			return configSchemeEntry.overridable;
		} else return false;
	},
	isConfigEntryOverrideOnly: (key: string): boolean => {
		const configSchemeEntry = M2D_CONFIG_SCHEME.find((v) => v.name === key);

		if(configSchemeEntry) {
			return configSchemeEntry.overrideOnly;
		} else return false;
	},
	deleteConfigOverride: (guildId: string, key: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Usuwanie wartości zastępującej dla klucza konfiguracyjnej "${key}" na serwerze o ID "${guildId}"...`)
			.then(() => {
				if(M2D_ConfigUtils.isConfigEntryKeyInScheme(key)) {
					if(M2D_ConfigUtils.isConfigEntryOverridable(key)) {
						if(!M2D_ConfigUtils.isConfigEntryOverrideOnly(key)) {
							return M2D_ConfigUtils.isConfigValueOverrideSet(guildId, key)
								.then((bool) => {
									if(bool) {
										const configEntryIdx = M2D_CONFIG.findIndex((v) => v.name === key);

										return new Promise<void>((res2, rej2) => {
											for(const [i,v] of M2D_CONFIG[configEntryIdx].guildOverrides.entries()) {
												if(v.guildId === guildId) {
													M2D_CONFIG[configEntryIdx].guildOverrides.splice(i, 1);
													res();
												}
											}
										});
									} else return Promise.reject({
										type: M2D_EErrorTypes.Config,
										subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
										data: { key, guildId }
									} as M2D_IConfigOverrideNotPresentError);
								})
						} else return Promise.reject({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.KeyOverrideOnly,
							data: { key }
						} as M2D_IConfigKeyOverrideOnlyError);
					} else return Promise.reject({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
						data: { key }
					} as M2D_IConfigKeyNotOverridableError);
				} else return Promise.reject({
					type: M2D_EErrorTypes.Config,
					subtype: M2D_EConfigErrorSubtypes.MissingKey,
					data: { key }
				} as M2D_IConfigMissingKeyError)
			})
			.then(() => res())
			.catch((err) => rej(err));
	}),
	deleteConfigOverridesOnGuild: (guildId: string) => new Promise<void>((res, rej) => {
		const configEntries = M2D_CONFIG.filter((v) => v.guildOverrides.filter((vv) => vv.guildId === guildId).length > 0);

		for(const [i,v] of configEntries.entries()) {
			for(const [_i,_v] of v.guildOverrides.entries()) {
				if(_v.guildId === guildId) {
					v.guildOverrides.splice(_i, 1);
				}
			}
		}

		res();
	}),
	getConfigValue: (key: string, guildId: string | null = null, logToConsole = true, logToFile = true) => new Promise<string>((res, rej) => {
		if(guildId) {
			M2D_ConfigUtils.getConfigOverrideValue(guildId, key, logToConsole, logToFile)
				.then((val) => res(val))
				.catch((err) => {
					if(err.subtype === M2D_EConfigErrorSubtypes.MissingKey) {
						rej(err as M2D_IConfigMissingKeyError);
					} else return M2D_ConfigUtils.getGlobalConfigValue(key, logToConsole, logToFile)
						.then((val) => res(val))
						.catch((err) => rej(err));
				});
		} else {
			M2D_ConfigUtils.getGlobalConfigValue(key, logToConsole, logToFile)
				.then((val) => res(val))
				.catch((err) => rej(err));
		}
	}),
	getConfigDefaultValue: (key: string, logToConsole = true, logToFile = true) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Pobieranie wartości domyślnej dla klucza konfiguracyjnego "${key}..."`)
			.then(() => {
				if(M2D_ConfigUtils.isConfigEntryKeyInScheme(key)) {
					const defaultValue = M2D_DEFAULT_CONFIG.find((v) => v.name === key);

					if(defaultValue) {
						return M2D_LogUtils.logMessage(`success`, `Pobrano wartość domyślną klucza konfiguracyjnego "${key}"!`)
							.then(() => defaultValue);	
					} else return M2D_LogUtils.logMessage(`error`, `Nie znaleziono "${key}" wśród kluczy domyślnej konfiguracji!`)
						.then(() => Promise.reject({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.MissingKey,
							data: { key }
						} as M2D_IConfigMissingKeyError));
				} else return M2D_LogUtils.logMessage(`error`, `"${key}" nie znajduje się w schemacie konfiguracji!`)
					.then(() => Promise.reject({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: { key }
					} as M2D_IConfigMissingKeyError));	
			})	
			.then((defaultValue) => res(defaultValue.value))
			.catch((err) => rej(err))
	}),
	setConfigOverride: (guildId: string, key: string, value: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości zastępującej dla wartości konfiguracyjnej o kluczu "${key}" na serwerze o ID "${guildId}"...`)

		let cKey = key;

		if(M2D_ConfigUtils.isConfigEntryLabelInScheme(cKey)) {
			M2D_LogUtils.logMessage(`info`, `"${cKey}" jest etykietą wartości konfiguracyjnej - szukanie klucza...`)
				.then(() => M2D_ConfigUtils.getConfigEntryKeyFromLabel(cKey)
					.then((_key) => { cKey = _key; })
				);
		} else if(M2D_ConfigUtils.isConfigEntryKeyInScheme(cKey)) {
			M2D_LogUtils.logMessage(`info`, `"${cKey}" jest kluczem wartości konfiguracyjnej.`);
		} else M2D_LogUtils.logMessage(`error`, `"${cKey}" nie jest ani etykietą, ani kluczem wartości konfiguracyjnej!`)
			.then(() => rej({
					type: M2D_EErrorTypes.Config,
					subtype: M2D_EConfigErrorSubtypes.MissingKey,
					data: {
						key: cKey
					}
				} as M2D_IConfigMissingKeyError)
			);
			
		M2D_ConfigUtils.getConfigSchemeEntry(cKey)
			.then((schemeEntry: M2D_IConfigSchemeEntry) => M2D_LogUtils.logMessage(`info`, `Znaleziono wpis "${cKey}" w schemacie konfiguracji - uzyskiwanie wpisu we właściwej konfiguracji...`)
				.then(() => {
					const configEntry = M2D_CONFIG.find((v) => v.name === cKey);

					if(configEntry) {
						M2D_LogUtils.logMessage(`success`, `Uzyskano wpis "${cKey}" z konfiguracji!`)
							.then(() => {
								if(schemeEntry.overridable) {
									if(!configEntry.guildOverrides) {
										const cEIDX = M2D_CONFIG.indexOf(configEntry);
										M2D_CONFIG[cEIDX].guildOverrides = [];
									}

									const configGuildOverrideEntry = configEntry.guildOverrides.find((v) => v.guildId === guildId);

									if(configGuildOverrideEntry) {
										const cEIDX = M2D_CONFIG.indexOf(configEntry);
										const cGOIDX = configEntry.guildOverrides.indexOf(configGuildOverrideEntry);

										M2D_CONFIG[cEIDX].guildOverrides[cGOIDX].value = value;
										M2D_LogUtils.logMessage(`success`, `Pomyślnie zmieniono wartość zastępującą klucza "${key}" dla serwera o ID "${guildId}" na "${value}"!`)
											.then(() => res());
									} else {
										const cEIDX = M2D_CONFIG.indexOf(configEntry);

										M2D_CONFIG[cEIDX].guildOverrides.push({
											guildId,
											value
										});
										M2D_LogUtils.logMessage(`success`, `Pomyślnie zmieniono wartość zastępującą klucza "${key}" dla serwera o ID "${guildId}" na "${value}"!`)
											.then(() => res());
									}
								} else M2D_LogUtils.logMessage(`error`, `Wartość klucza "${cKey}" jest niezastępywalna!`)
									.then(() => rej({
										type: M2D_EErrorTypes.Config,
										subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
										data: {
											key
										}
									} as M2D_IConfigKeyNotOverridableError));	
							});	
					} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono klucza "${cKey}" w konfiguracji!`)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.MissingKey,
							data: {
								key: cKey
							}
						} as M2D_IConfigMissingKeyError));
				})
			)
			.catch(() => M2D_LogUtils.logMessage(`error`, `Nie znaleziono klucza "${cKey}" w schemacie konfiguracji!`)
				.then(() => rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: {
							key: cKey
						}
					} as M2D_IConfigMissingKeyError)
				)
			);	
	}),
	getGlobalConfigValue: (key: string, logToConsole = true, logToFile = true) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości konfiguracyjnej o kluczu "${key}"...`, logToConsole, logToFile)
		let cKey = key;

		if(M2D_ConfigUtils.isConfigEntryLabelInScheme(cKey)) {
			M2D_LogUtils.logMessage(`info`, `"${cKey}" jest etykietą wartości konfiguracyjnej - szukanie klucza...`, logToConsole, logToFile)
				.then(() => M2D_ConfigUtils.getConfigEntryKeyFromLabel(cKey)
					.then((_key) => { cKey = _key; })
				);
		} else if(M2D_ConfigUtils.isConfigEntryKeyInScheme(cKey)) {
			M2D_LogUtils.logMessage(`info`, `"${cKey}" jest kluczem wartości konfiguracyjnej.`, logToConsole, logToFile);
		} else M2D_LogUtils.logMessage(`error`, `"${cKey}" nie jest ani etykietą, ani kluczem wartości konfiguracyjnej!`, logToConsole, logToFile)
			.then(() => rej({
					type: M2D_EErrorTypes.Config,
					subtype: M2D_EConfigErrorSubtypes.MissingKey,
					data: {
						key: cKey
					}
				} as M2D_IConfigMissingKeyError)
			);
			
		M2D_ConfigUtils.getConfigSchemeEntry(cKey)
			.then((schemeEntry: M2D_IConfigSchemeEntry) => M2D_LogUtils.logMessage(`info`, `Znaleziono wpis "${cKey}" w schemacie konfiguracji - uzyskiwanie wpisu we właściwej konfiguracji...`, logToConsole, logToFile)
				.then(() => {
					const configEntry = M2D_CONFIG.find((v) => v.name === cKey);

					if(configEntry) {
						M2D_LogUtils.logMessage(`success`, `Uzyskano wpis "${cKey}" z konfiguracji!`, logToConsole, logToFile)
							.then(() => {
								if(!schemeEntry.overrideOnly) {
									res(configEntry.value);
								} else M2D_LogUtils.logMessage(`error`, `Klucz "${cKey}" nie posiada globalnej wartości!`, logToConsole, logToFile)
									.then(() => rej({
										type: M2D_EErrorTypes.Config,
										subtype: M2D_EConfigErrorSubtypes.KeyOverrideOnly,
										data: {
											key: cKey
										}
									} as M2D_IConfigKeyOverrideOnlyError));
							});	
					} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono klucza "${cKey}" w konfiguracji!`, logToConsole, logToFile)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.MissingKey,
							data: {
								key: cKey
							}
						} as M2D_IConfigMissingKeyError));
				})
			)
			.catch(() => M2D_LogUtils.logMessage(`error`, `Nie znaleziono klucza "${cKey}" w schemacie konfiguracji!`, logToConsole, logToFile)
				.then(() => rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: {
							key: cKey
						}
					} as M2D_IConfigMissingKeyError)
				)
			);	
	}),
	getConfigOverrideValue: (guildId: string, key: string, logToConsole = true, logToFile = true) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości zastępującej dla wartości konfiguracyjnej o kluczu "${key}" na serwerze o ID "${guildId}"...`, logToConsole, logToFile)

		let cKey: string = key;

		if(M2D_ConfigUtils.isConfigEntryLabelInScheme(cKey)) {
			M2D_LogUtils.logMessage(`info`, `"${cKey}" jest etykietą wartości konfiguracyjnej - szukanie klucza...`, logToConsole, logToFile)
				.then(() => M2D_ConfigUtils.getConfigEntryKeyFromLabel(cKey)
					.then((_key) => { cKey = _key; })
				);
		} else if(M2D_ConfigUtils.isConfigEntryKeyInScheme(cKey)) {
			M2D_LogUtils.logMessage(`info`, `"${cKey}" jest kluczem wartości konfiguracyjnej.`, logToConsole, logToFile);
		} else M2D_LogUtils.logMessage(`error`, `"${cKey}" nie jest ani etykietą, ani kluczem wartości konfiguracyjnej!`, logToConsole, logToFile)
			.then(() => rej({
					type: M2D_EErrorTypes.Config,
					subtype: M2D_EConfigErrorSubtypes.MissingKey,
					data: {
						key: cKey
					}
				} as M2D_IConfigMissingKeyError)
			);
			
		M2D_ConfigUtils.getConfigSchemeEntry(cKey)
			.then((schemeEntry: M2D_IConfigSchemeEntry) => M2D_LogUtils.logMessage(`info`, `Znaleziono wpis "${cKey}" w schemacie konfiguracji - uzyskiwanie wpisu we właściwej konfiguracji...`, logToConsole, logToFile)
				.then(() => {
					const configEntry = M2D_CONFIG.find((v) => v.name === cKey);

					if(configEntry) {
						M2D_LogUtils.logMessage(`success`, `Uzyskano wpis "${cKey}" z konfiguracji! - szukanie wartości zastępującej...`, logToConsole, logToFile)
							.then(() => {
								if(schemeEntry.overridable) {
									if(configEntry.guildOverrides) {
										if(configEntry.guildOverrides.length > 0) {
											const configGuildEntry = configEntry.guildOverrides.find((v) => v.guildId === guildId);

											if(configGuildEntry) {
												M2D_LogUtils.logMessage("success", `Znaleziono wartość zastępującą klucza "${cKey}" dla serwera o ID "${guildId}"!`, logToConsole, logToFile)
													.then(() => res(configGuildEntry.value));
											} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono wartości zastępującej klucza "${cKey}" dla serwera o ID "${guildId}"!`, logToConsole, logToFile)
												.then(() => rej({
													type: M2D_EErrorTypes.Config,
													subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
													data: {
														key,
														guildId
													}
												} as M2D_IConfigOverrideNotPresentError));
										} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono wartości zastępującej klucza "${cKey}" dla serwera o ID "${guildId}"!`, logToConsole, logToFile)
											.then(() => rej({
												type: M2D_EErrorTypes.Config,
												subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
												data: {
													key,
													guildId
												}
											} as M2D_IConfigOverrideNotPresentError));
									} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono wartości zastępującej klucza "${cKey}" dla serwera o ID "${guildId}"!`, logToConsole, logToFile)
										.then(() => rej({
											type: M2D_EErrorTypes.Config,
											subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
											data: {
												key,
												guildId
											}
										} as M2D_IConfigOverrideNotPresentError));
								} else M2D_LogUtils.logMessage(`error`, `Wartość klucza "${cKey}" jest niezastępywalna!`, logToConsole, logToFile)
									.then(() => rej({
										type: M2D_EErrorTypes.Config,
										subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
										data: {
											key
										}
									} as M2D_IConfigKeyNotOverridableError));	
							});	
					} else M2D_LogUtils.logMessage(`error`, `Nie znaleziono klucza "${cKey}" w konfiguracji!`, logToConsole, logToFile)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.MissingKey,
							data: {
								key: cKey
							}
						} as M2D_IConfigMissingKeyError));
				})
			)
			.catch(() => M2D_LogUtils.logMessage(`error`, `Nie znaleziono klucza "${cKey}" w schemacie konfiguracji!`, logToConsole, logToFile)
				.then(() => rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.MissingKey,
						data: {
							key: cKey
						}
					} as M2D_IConfigMissingKeyError)
				)
			);	
	}),
	getConfigEntryKeyFromLabel: (label: string) => new Promise<string>((res, rej) => {
		if(M2D_ConfigUtils.isConfigEntryLabelInScheme(label)) {
			res((M2D_CONFIG_SCHEME.find((v) => v.label === label) as M2D_IConfigSchemeEntry).name);
		} else rej({
			type: M2D_EErrorTypes.Config,
			subtype: M2D_EConfigErrorSubtypes.MissingLabel,
			data: {
				label
			}
		} as M2D_IConfigMissingLabelError);
	}),
	getConfigEntryLabelFromKey: (key: string) => new Promise<string>((res, rej) => {
		if(M2D_ConfigUtils.isConfigEntryKeyInScheme(key)) {
			res((M2D_CONFIG_SCHEME.find((v) => v.name === key) as M2D_IConfigSchemeEntry).label);
		} else rej({
			type: M2D_EErrorTypes.Config,
			subtype: M2D_EConfigErrorSubtypes.MissingKey,
			data: {
				key
			}
		} as M2D_IConfigMissingKeyError);
	}),
	getConfigSchemeEntry: (key: string) => new Promise<M2D_IConfigSchemeEntry>((res, rej) => {
		if(M2D_ConfigUtils.isConfigEntryKeyInScheme(key)) {
			res(M2D_CONFIG_SCHEME.find((v) => v.name === key) as M2D_IConfigSchemeEntry);
		} else rej({
			type: M2D_EErrorTypes.Config,
			subtype: M2D_EConfigErrorSubtypes.MissingKey,
			data: {
				key
			}
		} as M2D_IConfigMissingKeyError);
	}),
	getConfig: (guildId: string) => new Promise<M2D_IConfigEntry[]>((res, rej) => {
		const configStrings: M2D_IConfigEntry[] = [];
		const promisesToHandle: Promise<any>[] = [];
		
		for(const [i, v] of M2D_CONFIG.entries()) {
			promisesToHandle.push(
				M2D_ConfigUtils.isConfigValueOverrideSet(guildId, v.name)
					.then((value: boolean) => {
						if(!value) { return Promise.reject(); }
						else {
							return M2D_ConfigUtils.getConfigOverrideValue(guildId, v.name)
								.then((override: string) => configStrings.push({ name: v.name, value: override, guildOverrides: [] }));
						}
					})
					.catch(() => configStrings.push({name: v.name, value: v.value, guildOverrides: []}))
			);	
		}

		Promise.all(promisesToHandle).then(() => res(configStrings));
	}),
	getConfigKeys: (): string[] => {
		return M2D_CONFIG_SCHEME.map((v) => v.name);
	},
	getConfigOverridableKeys: (): string[] => {
		return (M2D_CONFIG_SCHEME.filter((v) => v.overridable)).map((v) => v.name);
	},
	getConfigOverrides: (guildId: string) => new Promise<M2D_IConfigEntry[]>((res, rej) => {
		const configEntries: M2D_IConfigEntry[] = [];
		const promisesToHandle: Promise<any>[] = [];

		for(const [i, v] of M2D_CONFIG.entries()) {
			promisesToHandle.push(
				M2D_GeneralUtils.ignoreError(
					M2D_ConfigUtils.isConfigValueOverrideSet(guildId, v.name)
						.then((value: boolean) => {
							if(!value) { return Promise.reject(); }
							else {
								return M2D_ConfigUtils.getConfigOverrideValue(guildId, v.name)
									.then((override: string) => configEntries.push({ name: v.name, value: override, guildOverrides: [] }));
							}
						})	
				)
			);
		}

		Promise.all(promisesToHandle).then(() => res(configEntries));
	}),
	readConfigFile: () => new Promise<void>((res, rej) => {
				fs.readFile(M2D_ConfigFileLocation, {
					encoding: "utf-8",
					flag: "r"
				})
					.then((data: string) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano plik konfiguracyjny!")
						.then(() => {
							const newConfig: M2D_IConfigEntry[] = JSON.parse(data);
							M2D_ConfigUtils.validateConfig(newConfig)
								.then(() => { 
									M2D_CONFIG = newConfig;
									res();
								})
								.catch((err: M2D_IConfigConfigSchemeMismatchError) => {
									if(err.data.excessiveKeys.length === 0) {
										if(err.data.missingKeys.length > 0) {
											if(M2D_DEFAULT_CONFIG.length > 0) {
												for(const cse of M2D_CONFIG_SCHEME) {
													if(!(newConfig.find((v) => v.name === cse.name))) {
														newConfig.push({
															name: cse.name,
															value: (M2D_DEFAULT_CONFIG.find((v) => v.name === cse.name) as M2D_IConfigEntry).value,
															guildOverrides: []
														});
													}
												}
												M2D_CONFIG = newConfig;
												res();
											} else {
												M2D_LogUtils.logMultipleMessages(`error`, [`Wykryto brakujące klucze w konfiguracji, lecz nie można ich zastąpić wartościami domyślnymi. Domyślna konfiguracja nie została jeszcze wczytana!`])
													.then(() => rej({
														type: M2D_EErrorTypes.Config,
														subtype: M2D_EConfigErrorSubtypes.NoDefaultConfig,
														data: {}
													} as M2D_IConfigNoDefaultConfigError))	
											}
										} else rej(err);
									} else rej(err);
								});	
						}))
					.catch(err => M2D_LogUtils.logMessage("error", `Nie udało się wczytać konfiguracji z pliku "${M2D_ConfigFileLocation}"`)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.Filesystem,
							data: {
								errorMessage: err.message,
								path: M2D_ConfigFileLocation
							}
						} as M2D_IConfigFilesystemError))
					);
	}),
	readDefaultConfigFile: () => new Promise<void>((res, rej) => {
				fs.readFile("m2d_defaultconfig.json", {
					encoding: "utf-8",
					flag: "r"
				})
					.then((data: string) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano domyślny plik konfiguracyjny!")
						.then(() => {
							const newDefaultConfig = JSON.parse(data) as M2D_IConfigEntry[];
							M2D_ConfigUtils.validateConfig(newDefaultConfig)
								.then(() => {
									M2D_DEFAULT_CONFIG = newDefaultConfig;
									res();
								})
								.catch((err: M2D_IConfigConfigSchemeMismatchError) => rej(err));	
						}))
					.catch(err => M2D_LogUtils.logMessage("error", `Nie udało się wczytać konfiguracji z domyślnego pliku konfiguracyjnego!`)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.Filesystem,
							data: {
								errorMessage: err.message,
								path: "m2d_defaultconfig.json"
							}
						} as M2D_IConfigFilesystemError))
					);
	}),
	readConfigSchemeFile: () => new Promise<void>((res, rej) => {
		let M2D_ConfigSchemeFileLocation = `m2d_configscheme.json`;

		M2D_GeneralUtils.getEnvVar("CONFIG_SCHEME_FILE")
			.then((val) => M2D_LogUtils.logMessage(`info`, `Znaleziono zmienną środowiskową "M2D_CONFIG_SCHEME_FILE" - stosowanie się do jej ustawień...`)
				.then(() => { 
					M2D_ConfigSchemeFileLocation = val;
				})
			)
			.catch(() => M2D_LogUtils.logMessage(`warn`, `Nie znaleziono zmiennej środowiskowej "M2D_CONFIG_SCHEME_FILE" - stosowanie domyślnego ustawienia...`))
			.then(() => {
				fs.readFile(M2D_ConfigSchemeFileLocation, { encoding: "utf-8" })
					.then((data) => M2D_LogUtils.logMessage(`success`, `Pomyślnie wczytano schemat konfiguracji z pliku "${M2D_ConfigSchemeFileLocation}"!`)
						.then(() => {
							M2D_CONFIG_SCHEME = JSON.parse(data) as M2D_IConfigSchemeEntry[];
							res();
						})
						.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas wczytywania schematu konfiguracji z pliku "${M2D_ConfigSchemeFileLocation}".`, `Treść błędu: "${err.message}"`])
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.Filesystem,
								data: {
									errorMessage: err.message,
									path: M2D_ConfigSchemeFileLocation
								}
							} as M2D_IConfigFilesystemError))
						)
					)	
			});
	}),
	saveConfigToFile: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage("info", "Zainicjowano zapis konfiguracji do pliku...")
			.then(() => M2D_ConfigUtils.validateConfig())
			.then(() => {
				fs.writeFile(M2D_ConfigFileLocation, JSON.stringify(M2D_CONFIG), {
					encoding: "utf-8"
				})
					.then(() => {
						M2D_LogUtils.logMessage("success", `Pomyślnie zapisano konfigurację do "${M2D_ConfigFileLocation}"`)
							.then(() => res());
					})
					.catch((err) => {
						M2D_LogUtils.logMessage("error", `Nie udało się zapisać konfiguracji do "${M2D_ConfigFileLocation}"`)
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.Filesystem,
								data: {
									errorMessage: err.message,
									path: M2D_ConfigFileLocation
								}
							} as M2D_IConfigFilesystemError));
					})
			})
			.catch((err: M2D_IConfigConfigSchemeMismatchError) => rej(err));
	}),
	validateConfig: (config?: M2D_IConfigEntry[]) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano walidację konfiguracji...`)
			.then(() => {	
				const missingKeys: string[] = [];
				const excessiveKeys: string[] = [];

				const configToCheck: M2D_IConfigEntry[] = (config) ? config : M2D_CONFIG;
				
				for(const cse of M2D_CONFIG_SCHEME) {
					if(!(configToCheck.find((v) => v.name === cse.name))) {
						missingKeys.push(cse.name);
					}
				}
				for(const ce of configToCheck) {
					if(!(M2D_CONFIG_SCHEME.find((v) => v.name === ce.name))) {
						excessiveKeys.push(ce.name);
					}
				}

				if(missingKeys.length === 0 && excessiveKeys.length === 0) {
					M2D_LogUtils.logMessage(`success`, `Walidacja zakończona. Nie wykryto żadnych odchyłów.`)
						.then(() => res());
				} else M2D_LogUtils.logMultipleMessages(`error`, [`Znaleziono odchyły w konfiguracji względem schematu.`, `Brakujące klucze: "${missingKeys.join(", ")}"`, `Ponadprogramowe klucze: "${excessiveKeys.join(", ")}"`])
					.then(() => rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.ConfigSchemeMismatch,
						data: {
							excessiveKeys,
							missingKeys
						}
					} as M2D_IConfigConfigSchemeMismatchError));
			});
	}),
	initConfigCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie konfiguracji...`)
			.then(() => M2D_ConfigUtils.readConfigSchemeFile()
				.then(() => M2D_LogUtils.logMessage(`info`, `Wczytywanie domyślnej konfiguracji z pliku...`)
					.then(() => M2D_ConfigUtils.readDefaultConfigFile()
						.catch((err: M2D_Error) => {
							if(M2D_GeneralUtils.getErrorString(err) === "CONFIG_CONFIG_SCHEME_MISMATCH") {
								err = err as M2D_IConfigConfigSchemeMismatchError;
								M2D_LogUtils.logMultipleMessages(`error`, [`Wykryto odchylenia w domyślnej konfiguracji!`, `Brakujące klucze: "${err.data.missingKeys.join(", ")}"`, `Ponadprogramowe klucze: "${err.data.excessiveKeys.join(", ")}"`, `Muzyk2D w takim stanie nie może kontynuować pracy.`])
									.then(() => Promise.reject(err));
							} else return Promise.reject(err);
						})
					)
					.catch((err) => Promise.reject(err))
				)
				.then(() => M2D_GeneralUtils.getEnvVar("CONFIG_FILE")
					.then((getEnvVar_retData) => M2D_LogUtils.logMessage("info", `Znaleziono zmienną środowiskową "M2D_CONFIG_FILE" - stosowanie się do jej wartości...`)
						.then(() => {
							M2D_ConfigFileLocation = getEnvVar_retData;
						})
					)
					.catch((getEnvVar_errData: M2D_IGeneralNoEnvVariableError) => M2D_LogUtils.logMessage("warn", `Nie znaleziono zmiennej środowiskowej "M2D_CONFIG_FILE" - stosowanie domyślnej wartości...`))
				)
				.then(() => M2D_GeneralUtils.getEnvVar("FORCE_READ_DEFAULT_CONFIG")
						.then((val) => val)
						.catch(() => M2D_LogUtils.logMessage(`info`, `Nie znaleziono zmiennej środowiskowej "M2D_FORCE_READ_DEFAULT_CONFIG" - pomijanie...`))
				)
				.then((val) => {
					if(val === "true") {
						M2D_LogUtils.logMessage(`info`, `Wymuszono wczytanie domyślnej konfiguracji poprzez zmienną środowiskową.`)
							.then(() => {
								M2D_CONFIG = M2D_DEFAULT_CONFIG;
								return Promise.resolve();
							});
					} else {
						M2D_ConfigUtils.readConfigFile()
							.then(() => Promise.resolve())
							.catch(() => {
								M2D_LogUtils.logMessage(`warn`, `Nie udało się wczytać konfiguracji z pliku "${M2D_ConfigFileLocation}". Wczytywanie domyślnej konfiguracji...`)
									.then(() => {
										M2D_CONFIG = M2D_DEFAULT_CONFIG;
										return Promise.resolve();
									});
							});
					}
				})
				.then(() => M2D_CommandUtils.addCommands(M2D_CONFIG_COMMANDS))
				.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano konfigurację!`))
				.then(() => res())
				.catch((err) => rej(err))
			);
	}),
	configExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie konfiguracji...`)
			.then(() => M2D_ConfigUtils.saveConfigToFile()
				.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono konfigurację!`)
					.then(() => res())
				)
				.catch((err) => rej(err))
			);
	})
};

const M2D_CONFIG_COMMANDS: M2D_ICommand[] = [
	{
		name: "printconfig",
		aliases: ["pc", "wypiszkonfigurację"],
		description: "Wypisuje pełną konfigurację (wraz z modyfikacjami na poziomie tego serwera)",
		parameters: [],
		category: M2D_CATEGORIES.config,
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters: M2D_ICommandSuppParameters | undefined) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_ConfigUtils.getConfig(guild.id)
					.then((configEntries) => {
						const configStrings = (configEntries.length > 0) ? configEntries.map((v) => `**Nazwa**: \`${v.name}\`\n**Wartość**: \`${(v.value.length !== 0) ? v.value : " "}\``) : `**Brak wpisów**`;

						M2D_MessagesUtils.getMessage("configPrint", [ (typeof configStrings === "string") ? configStrings : configStrings.join("\n\n")])
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, { embeds: [ msg ] }))
							.then(() => res())
							.catch((err) => rej(err));
					})	
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError)
		}),
		errorHandler: (error: M2D_Error, cmd: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters: M2D_ICommandSuppParameters | undefined) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}
		})
	},
	{
		name: "printconfigoverrides",
		aliases: ["pco", "wypiszModKonfiguracji"],
		description: "Wypisuje klucze konfiguracji, które zostały zmodyfikowane na tym serwerze, wraz z ich wartościami",
		category: M2D_CATEGORIES.config,
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_ConfigUtils.getConfigOverrides(guild.id)
					.then((configEntries) => {
						const configStrings = (configEntries.length > 0) ? configEntries.map((v) => `**Nazwa**: \`${v.name}\`\n**Wartość**: \`${(v.value.length !== 0) ? v.value : " "}\``) : `**Brak wpisów**`;

						M2D_MessagesUtils.getMessage("configOverrides", [ guild.name, (typeof configStrings === "string") ? configStrings : configStrings.join("\n\n")])
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, { embeds: [ msg ] }))
							.then(() => res())
							.catch((err) => rej(err));
					});	
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}
		})
	},
	{
		name: "printconfigkey",
		aliases: ["pck", "kluczKonfiguracji"],
		category: M2D_CATEGORIES.config,
		description: "Wypisuje wartość podanego klucza konfiguracji",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		parameters: [{
			name: "configKey",
			label: "kluczKonfiguracji",
			description: "Klucz konfiguracji, którego wartość ma zostać wypisana",
			required: true
		}],
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "configKey")
					.then((key) => {
						if(M2D_ConfigUtils.isConfigEntryKeyInScheme(key)) {
							return M2D_ConfigUtils.getConfigValue(key, guild.id, false, false)
								.then((configvalue) => M2D_MessagesUtils.getMessage("configKeyPrint", [ key, configvalue ]))
								.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, { embeds: [ msg ] }))
								.then(() => res())
								.catch((err) => Promise.reject(err))
						} else return Promise.reject({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.MissingKey,
							data: {
								key
							}
						} as M2D_IConfigMissingKeyError)
					})
					.catch((err) => rej(err));	
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}
		})
	},
	{
		name: "resetKey",
		aliases: ["rk", "resetujKlucz"],
		category: M2D_CATEGORIES.config,
		description: "Resetuje podany klucz konfiguracji do wartości domyślnej",
		parameters: [{
			name: "configKey",
			label: "kluczKonfiguracji",
			description: "Klucz konfiguracji, którego wartość ma zostać zresetowana",
			required: true
		}],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "configKey")
					.then((key) => {
						if(M2D_ConfigUtils.isConfigEntryKeyInScheme(key)) {
							if(M2D_ConfigUtils.isConfigEntryOverridable(key)) {
								return M2D_ConfigUtils.deleteConfigOverride(guild.id, key)
									.then(() => M2D_MessagesUtils.getMessage("configKeyOverrideDeleted", [ key ]))
									.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, { embeds: [ msg ] }))
									.catch((err) => Promise.reject(err));
							} else return Promise.reject({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
								data: {
									key
								}
							} as M2D_IConfigKeyNotOverridableError);
						} else return Promise.reject({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.MissingKey,
							data: {
								key
							}
						} as M2D_IConfigMissingKeyError);
					})
					.catch((err) => rej(err));	
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}	
		})
	},
	{
		name: "setconfigoverride",
		aliases: ["ustawKonfiguracje", "sco"],
		category: M2D_CATEGORIES.config,
		parameters: [{
			name: "configKey",
			label: "kluczKonfiguracji",
			description: "Klucz konfiguracji, którego wartość ma zostać ustawiona",
			required: true
		}, {
			name: "value",
			label: "wartość",
			description: "Wartość, którą otrzyma klucz",
			required: true
		}],
		description: "Ustawia wartość klucza konfiguracyjnego",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "configKey")
					.then((key) => M2D_CommandUtils.getParameterValue(parameters, "value")
						.then((value) => M2D_ConfigUtils.setConfigOverride(guild.id, key, value)
							.then(() => M2D_MessagesUtils.getMessage("configKeyOverriden", [ key, value ]))
						)
					)
					.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, { embeds: [ msg ] }))
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: { commandName: cmd.name }
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}
		})
	},
	{
		name: "listKeys",
		aliases: ["lk", "wypiszKlucze"],
		description: "Wypisuje dostępne klucze konfiguracji",
		category: M2D_CATEGORIES.config,
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_MessagesUtils.getMessage("configOverridableKeys", [ ((M2D_ConfigUtils.getConfigOverridableKeys()).map((v) => `\`${v}\``)).join("\n") ])
					.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, { embeds: [ msg ] }))
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: { commandName: cmd.name }
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}
		})
	}
];
//#region Exports
	export type {
		M2D_IConfigEntry,
		M2D_IConfigGuildEntry,
		M2D_IConfigFilesystemError,
		M2D_IConfigMissingKeyError,
		M2D_IConfigMissingLabelError,
		M2D_IConfigKeyNotOverridableError,
		M2D_IConfigConfigSchemeMismatchError,
		M2D_IConfigNoDefaultConfigError,
		M2D_ConfigError
	}
	export {
		M2D_EConfigErrorSubtypes,
		M2D_ConfigUtils
	}
//#endregion