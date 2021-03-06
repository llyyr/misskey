import * as EventEmitter from 'events';
import * as Router from 'koa-router';
import * as request from 'request';
import * as crypto from 'crypto';
import User from '../../../../models/user';
import config from '../../../../config';
import BotCore from '../core';
import _redis from '../../../../db/redis';
import prominence = require('prominence');
import getAcct from '../../../../acct/render';
import parseAcct from '../../../../acct/parse';
import getNoteSummary from '../../../../renderers/get-note-summary';
import getUserName from '../../../../renderers/get-user-name';

const redis = prominence(_redis);

// SEE: https://developers.line.me/media/messaging-api/messages/sticker_list.pdf
const stickers = [
	'297',
	'298',
	'299',
	'300',
	'301',
	'302',
	'303',
	'304',
	'305',
	'306',
	'307'
];

class LineBot extends BotCore {
	private replyToken: string;

	private reply(messages: any[]) {
		request.post({
			url: 'https://api.line.me/v2/bot/message/reply',
			headers: {
				'Authorization': `Bearer ${config.line_bot.channel_access_token}`
			},
			json: {
				replyToken: this.replyToken,
				messages: messages
			}
		}, (err, res, body) => {
			if (err) {
				console.error(err);
				return;
			}
		});
	}

	public async react(ev: any): Promise<void> {
		this.replyToken = ev.replyToken;

		switch (ev.type) {
			// メッセージ
			case 'message':
				switch (ev.message.type) {
					// テキスト
					case 'text':
						const res = await this.q(ev.message.text);
						if (res == null) return;
						// 返信
						this.reply([{
							type: 'text',
							text: res
						}]);
						break;

					// スタンプ
					case 'sticker':
						// スタンプで返信
						this.reply([{
							type: 'sticker',
							packageId: '4',
							stickerId: stickers[Math.floor(Math.random() * stickers.length)]
						}]);
						break;
				}
				break;

			// noteback
			case 'noteback':
				const data = ev.noteback.data;
				const cmd = data.split('|')[0];
				const arg = data.split('|')[1];
				switch (cmd) {
					case 'showtl':
						this.showUserTimelineNoteback(arg);
						break;
				}
				break;
		}
	}

	public static import(data) {
		const bot = new LineBot();
		bot._import(data);
		return bot;
	}

	public async showUserCommand(q: string) {
		const user = await require('../../endpoints/users/show')(parseAcct(q.substr(1)), this.user);

		const acct = getAcct(user);
		const actions = [];

		actions.push({
			type: 'noteback',
			label: 'タイムラインを見る',
			data: `showtl|${user.id}`
		});

		if (user.twitter) {
			actions.push({
				type: 'uri',
				label: 'Twitterアカウントを見る',
				uri: `https://twitter.com/${user.twitter.screenName}`
			});
		}

		actions.push({
			type: 'uri',
			label: 'Webで見る',
			uri: `${config.url}/@${acct}`
		});

		this.reply([{
			type: 'template',
			altText: await super.showUserCommand(q),
			template: {
				type: 'buttons',
				thumbnailImageUrl: `${user.avatarUrl}?thumbnail&size=1024`,
				title: `${getUserName(user)} (@${acct})`,
				text: user.description || '(no description)',
				actions: actions
			}
		}]);

		return null;
	}

	public async showUserTimelineNoteback(userId: string) {
		const tl = await require('../../endpoints/users/notes')({
			userId: userId,
			limit: 5
		}, this.user);

		const text = `${getUserName(tl[0].user)}さんのタイムラインはこちらです:\n\n` + tl
			.map(note => getNoteSummary(note))
			.join('\n-----\n');

		this.reply([{
			type: 'text',
			text: text
		}]);
	}
}

const handler = new EventEmitter();

handler.on('event', async (ev) => {

	const sourceId = ev.source.userId;
	const sessionId = `line-bot-sessions:${sourceId}`;

	const session = await redis.get(sessionId);
	let bot: LineBot;

	if (session == null) {
		const user = await User.findOne({
			host: null,
			'line': {
				userId: sourceId
			}
		});

		bot = new LineBot(user);

		bot.on('signin', user => {
			User.update(user._id, {
				$set: {
					'line': {
						userId: sourceId
					}
				}
			});
		});

		bot.on('signout', user => {
			User.update(user._id, {
				$set: {
					'line': {
						userId: null
					}
				}
			});
		});

		redis.set(sessionId, JSON.stringify(bot.export()));
	} else {
		bot = LineBot.import(JSON.parse(session));
	}

	bot.on('updated', () => {
		redis.set(sessionId, JSON.stringify(bot.export()));
	});

	if (session != null) bot.refreshUser();

	bot.react(ev);
});

// Init router
const router = new Router();

if (config.line_bot) {
	router.post('/hooks/line', ctx => {
		const sig1 = ctx.headers['x-line-signature'];

		const hash = crypto.createHmac('SHA256', config.line_bot.channel_secret)
			.update(ctx.request.rawBody);

		const sig2 = hash.digest('base64');

		// シグネチャ比較
		if (sig1 === sig2) {
			ctx.request.body.events.forEach(ev => {
				handler.emit('event', ev);
			});
		} else {
			ctx.status = 400;
		}
	});
}

module.exports = router;
