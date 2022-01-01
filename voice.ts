//#region Imports
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError } from "utils";
	import { VoiceConnection, AudioPlayer, AudioResource, joinVoiceChannel, DiscordGatewayAdapterCreator } from "@discordjs/voice";
	import { Guild, VoiceChannel } from "discord.js";
	import { M2D_IClientMissingGuildError, M2D_IClientMissingChannelError, M2D_EClientErrorSubtypes, M2D_ClientUtils } from "client";
//#endregion

//#region Types
	interface M2D_IVoiceConnection {
		guildId: string;
		channelId: string;
		voiceConnection: VoiceConnection;
	};
	//#region Error types
		const enum M2D_EVoiceErrorSubtypes {
			AlreadyConnected = "ALREADY_CONNECTED",
			AlreadyDisconnected = "ALREADY_DISCONNECTED"
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
				channelId: string;
			}
		};
	//#endregion
//#endregion

const M2D_VOICE_CONNECTIONS: M2D_IVoiceConnection[] = [];

const M2D_VoiceUtils = {
	doesVoiceConnectionExistOnGuild: (guildId: string) => M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId),
	createVoiceConnection: (guild: Guild, channelId: string) => new Promise<void>((res, rej) => {
		if(M2D_ClientUtils.doesGuildExist(guild.id)) {
			if(M2D_ClientUtils.doesChannelExist(channelId)) {
				const vC = joinVoiceChannel({
					guildId: guild.id,
					channelId,
					adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
				});
				M2D_VOICE_CONNECTIONS.push({
					guildId: guild.id,
					channelId,
					voiceConnection: vC
				});
				res();
			} else rej({
				type: M2D_EErrorTypes.Client,
				subtype: M2D_EClientErrorSubtypes.MissingChannel,
				data: {
					channelId
				}
			} as M2D_IClientMissingChannelError);
		} else rej({
			type: M2D_EErrorTypes.Client,
			subtype: M2D_EClientErrorSubtypes.MissingGuild,
			data: {
				guildId: guild.id
			}
		} as M2D_IClientMissingGuildError);
	}),
	destroyVoiceConnection: (guildId: string) => new Promise<void>((res, rej) => {

	}),
	initVoiceCapabilities: () => new Promise<void>((res, rej) => {

	})
};

//#region Exports
	export type {
		M2D_IVoiceConnection,
		M2D_IVoiceAlreadyConnectedError,
		M2D_IVoiceAlreadyDisconnectedError
	};
	export {
		M2D_EVoiceErrorSubtypes,
		M2D_VoiceUtils
	};
//#endregion