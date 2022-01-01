//#region Imports
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError } from "./utils";
	import { VoiceConnection, AudioPlayer, AudioResource, joinVoiceChannel, DiscordGatewayAdapterCreator, VoiceConnectionState, VoiceConnectionStatus } from "@discordjs/voice";
	import { Guild, GuildBasedChannel, GuildMember, VoiceChannel } from "discord.js";
	import { M2D_IClientMissingGuildError, M2D_IClientMissingChannelError, M2D_EClientErrorSubtypes, M2D_ClientUtils, M2D_IClientMissingGuildChannelError, M2D_IClientInsufficientPermissionsError } from "./client";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_LogUtils } from "./log";
//#endregion

//#region Types
	interface M2D_IVoiceConnection {
		guildId: string;
		channelId: string;
		voiceConnection: VoiceConnection;
		noVCMembersElapsedTime: number;
	};
	//#region Error types
		const enum M2D_EVoiceErrorSubtypes {
			AlreadyConnected = "ALREADY_CONNECTED",
			AlreadyDisconnected = "ALREADY_DISCONNECTED",
			WrongChannelType = "WRONG_CHANNEL_TYPE"
		};
		interface M2D_IVoiceAlreadyConnectedError extends M2D_IError {
			data: {
				guildId: string;
				channelId: string;
			}
		};
		interface M2D_IVoiceAlreadyDisconnectedError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IVoiceWrongChannelTypeError extends M2D_IError {
			data: {
				channel: GuildBasedChannel;
			}
		};
		type M2D_VoiceError = M2D_IVoiceAlreadyConnectedError |
			M2D_IVoiceAlreadyDisconnectedError |
			M2D_IVoiceWrongChannelTypeError;
	//#endregion
//#endregion

let noVCMembersTimeout = 60;
const M2D_VOICE_CONNECTIONS: M2D_IVoiceConnection[] = [];

const M2D_VoiceNoVCMembersTimer = setInterval(async () => {
	for(const [i, v] of M2D_VOICE_CONNECTIONS.entries()) {
		M2D_ClientUtils.getGuildFromId(v.guildId)
			.then((guild) => M2D_ClientUtils.getGuildChannelFromId(v.guildId, v.channelId)
				.then((channel: GuildBasedChannel) => {
					if(channel.isVoice()) {
						let minVCMembers: number;
						
						M2D_ConfigUtils.getConfigValue("minVCMembers")
							.then((val) => minVCMembers = parseInt(val, 10))
							.catch(() => minVCMembers = 1)
							.then(() => {
								if(((channel as VoiceChannel).members.size - 1) < minVCMembers) {
									if(v.noVCMembersElapsedTime < noVCMembersTimeout) {
										M2D_VOICE_CONNECTIONS[i].noVCMembersElapsedTime++;
									} else {
										M2D_LogUtils.logMessage(`info`, `Na kanale "${channel.name}" znajduje się mniej użytkowników, niż na to zezwala "minVCMembers" i dozwolony czas już upłynął. Rozłączanie z kanału...`)
											.then(() => M2D_VoiceUtils.destroyVoiceConnection(v.guildId))
											.catch(() => {return;});
									}
								} else {
									if(v.noVCMembersElapsedTime > 0) M2D_VOICE_CONNECTIONS[i].noVCMembersElapsedTime = 0;
								}
							});
					}
				})
			)
	}
}, 1000);

const M2D_VoiceUtils = {
	doesVoiceConnectionExistOnGuild: (guildId: string) => M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) !== undefined,
	createVoiceConnection: (guildId: string, channelId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Nawiązywanie połączenia z kanałem głosowym o ID "${channelId}" na serwerze o ID "${guildId}"...`)
			.then(() => { 
				if(!M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
					M2D_ClientUtils.getGuildFromId(guildId)
						.then((guild: Guild) => M2D_LogUtils.logMessage(`info`, `Nazwa serwera: "${guild.name}"`)
							.then(() => M2D_ClientUtils.getGuildChannelFromId(guildId, channelId)
								.then((channel: GuildBasedChannel) => M2D_LogUtils.logMessage(`info`, `Nazwa kanału: "${channel.name}"`)
									.then(() => {
										if(channel.isVoice()) {
											channel = channel as VoiceChannel;
											const client = M2D_ClientUtils.getClient();

											if(channel.permissionsFor(guild.members.cache.find((v) => v.user === client.user) as GuildMember).has([
												"CONNECT",
												"SPEAK",
												"USE_VAD"
											])) {
												const vC = joinVoiceChannel({
													channelId: channel.id,
													guildId: guild.id,
													adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
												});
												// TODO: Add state change handler
												M2D_VOICE_CONNECTIONS.push({
													guildId: guild.id,
													channelId: channel.id,
													voiceConnection: vC,
													noVCMembersElapsedTime: 0
												});
												M2D_LogUtils.logMessage(`success`, `Pomyślnie nawiązano połączenie z kanałem głosowym "${channel.name}" na serwerze "${guild.name}"!`)
													.then(() => res());
											} else M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Brakujące uprawnienia`)
												.then(() => rej({
													type: M2D_EErrorTypes.Client,
													subtype: M2D_EClientErrorSubtypes.InsufficientPermissions,
													data: {
														guild,
														channel,
														permissions: [ "CONNECT", "SPEAK", "USE_VAD" ]
													}
												} as M2D_IClientInsufficientPermissionsError));
										} else M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Podany kanał ("${channel.name}", "${channelId}") nie jest kanałem głosowym!`)
											.then(() => rej({
												type: M2D_EErrorTypes.Voice,
												subtype: M2D_EVoiceErrorSubtypes.WrongChannelType,
												data: {
													channel
												}
											} as M2D_IVoiceWrongChannelTypeError));
									})
								)
								.catch((err: M2D_IClientMissingGuildChannelError) => M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Nie znaleziono kanału o ID "${channelId}" na serwerze o ID "${guildId}"`)
									.then(() => rej(err))
								)
							)
						)
						.catch((err: M2D_IClientMissingGuildError) => M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Nie znaleziono serwera o ID "${guildId}"!`)
							.then(() => rej(err))
						);
				} else M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Już nawiązano wcześniej połączenie z kanałem głosowym na serwerze o ID "${guildId}"!`)
					.then(() => {
						const vC = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;
						rej({
							type: M2D_EErrorTypes.Voice,
							subtype: M2D_EVoiceErrorSubtypes.AlreadyConnected,
							data: {
								guildId: vC.guildId,
								channelId: vC.channelId
							}
						} as M2D_IVoiceAlreadyConnectedError);
					});	
			});
	}),
	destroyVoiceConnection: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano rozłączenie z kanałem głosowym na serwerze o ID "${guildId}"...`)
			.then(() => {
				if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
					const voiceConnection = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;

					voiceConnection.voiceConnection.destroy();
					const vcIdx = M2D_VOICE_CONNECTIONS.findIndex(v => v === voiceConnection);
					M2D_VOICE_CONNECTIONS.splice(vcIdx, 1);

					M2D_LogUtils.logMessage(`success`, `Pomyślnie rozłączono z kanałem głosowym na serwerze o ID "${guildId}"!`)
						.then(() => res());
				} else M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas rozłączania z kanałem głosowym!`, `Powód: Nie podłączono do żadnego kanału głosowego`)
					.then(() => rej({
						type: M2D_EErrorTypes.Voice,
						subtype: M2D_EVoiceErrorSubtypes.AlreadyDisconnected,
						data: {
							guildId
						}
					} as M2D_IVoiceAlreadyDisconnectedError));
			});
	}),
	initVoiceCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie możliwości głosowych...`)
			.then(() => M2D_ConfigUtils.getConfigValue("noVCMembersTimeout")
				.then((val) => {
					noVCMembersTimeout = parseInt(val, 10);
				})
				.catch(() => {return;})
			)
			.then(() => {
				M2D_VoiceNoVCMembersTimer.refresh();
				M2D_LogUtils.logMessage(`success`, `Zainicjalizowano możliwości głosowe!`)
					.then(() => res());
			});
	})
};

//#region Exports
	export type {
		M2D_IVoiceConnection,
		M2D_IVoiceAlreadyConnectedError,
		M2D_IVoiceAlreadyDisconnectedError,
		M2D_VoiceError
	};
	export {
		M2D_EVoiceErrorSubtypes,
		M2D_VoiceUtils
	};
//#endregion