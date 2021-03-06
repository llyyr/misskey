/**
 * Module dependencies
 */
const ms = require('ms');
import $ from 'cafy';
import Note, { pack } from '../../../../models/note';

/**
 * Get trend notes
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	// Get 'limit' parameter
	const [limit = 10, limitErr] = $(params.limit).optional.number().range(1, 100).get();
	if (limitErr) return rej('invalid limit param');

	// Get 'offset' parameter
	const [offset = 0, offsetErr] = $(params.offset).optional.number().min(0).get();
	if (offsetErr) return rej('invalid offset param');

	// Get 'reply' parameter
	const [reply, replyErr] = $(params.reply).optional.boolean().get();
	if (replyErr) return rej('invalid reply param');

	// Get 'renote' parameter
	const [renote, renoteErr] = $(params.renote).optional.boolean().get();
	if (renoteErr) return rej('invalid renote param');

	// Get 'media' parameter
	const [media, mediaErr] = $(params.media).optional.boolean().get();
	if (mediaErr) return rej('invalid media param');

	// Get 'poll' parameter
	const [poll, pollErr] = $(params.poll).optional.boolean().get();
	if (pollErr) return rej('invalid poll param');

	const query = {
		createdAt: {
			$gte: new Date(Date.now() - ms('1days'))
		},
		renoteCount: {
			$gt: 0
		}
	} as any;

	if (reply != undefined) {
		query.replyId = reply ? { $exists: true, $ne: null } : null;
	}

	if (renote != undefined) {
		query.renoteId = renote ? { $exists: true, $ne: null } : null;
	}

	if (media != undefined) {
		query.mediaIds = media ? { $exists: true, $ne: null } : null;
	}

	if (poll != undefined) {
		query.poll = poll ? { $exists: true, $ne: null } : null;
	}

	// Issue query
	const notes = await Note
		.find(query, {
			limit: limit,
			skip: offset,
			sort: {
				renoteCount: -1,
				_id: -1
			}
		});

	// Serialize
	res(await Promise.all(notes.map(async note =>
		await pack(note, user, { detail: true }))));
});
