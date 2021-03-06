/**
 * Module dependencies
 */
import $ from 'cafy';
import User, { pack } from '../../../../models/user';

/**
 * Search a user by username
 */
module.exports = (params, me) => new Promise(async (res, rej) => {
	// Get 'query' parameter
	const [query, queryError] = $(params.query).string().get();
	if (queryError) return rej('invalid query param');

	// Get 'offset' parameter
	const [offset = 0, offsetErr] = $(params.offset).optional.number().min(0).get();
	if (offsetErr) return rej('invalid offset param');

	// Get 'limit' parameter
	const [limit = 10, limitErr] = $(params.limit).optional.number().range(1, 100).get();
	if (limitErr) return rej('invalid limit param');

	const users = await User
		.find({
			usernameLower: new RegExp(query.toLowerCase())
		}, {
			limit: limit,
			skip: offset
		});

	// Serialize
	res(await Promise.all(users.map(async user =>
		await pack(user, me, { detail: true }))));
});
