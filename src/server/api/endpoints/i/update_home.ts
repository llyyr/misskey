/**
 * Module dependencies
 */
import $ from 'cafy';
import User from '../../../../models/user';
import event from '../../../../publishers/stream';

module.exports = async (params, user) => new Promise(async (res, rej) => {
	// Get 'home' parameter
	const [home, homeErr] = $(params.home).optional.array().each(
		$().object(true)
			.have('name', $().string())
			.have('id', $().string())
			.have('place', $().string())
			.have('data', $().object())).get();
	if (homeErr) return rej('invalid home param');

	// Get 'id' parameter
	const [id, idErr] = $(params.id).optional.string().get();
	if (idErr) return rej('invalid id param');

	// Get 'data' parameter
	const [data, dataErr] = $(params.data).optional.object().get();
	if (dataErr) return rej('invalid data param');

	if (home) {
		await User.update(user._id, {
			$set: {
				'clientSettings.home': home
			}
		});

		res();

		event(user._id, 'home_updated', {
			home
		});
	} else {
		if (id == null && data == null) return rej('you need to set id and data params if home param unset');

		const _home = user.clientSettings.home;
		const widget = _home.find(w => w.id == id);

		if (widget == null) return rej('widget not found');

		widget.data = data;

		await User.update(user._id, {
			$set: {
				'clientSettings.home': _home
			}
		});

		res();

		event(user._id, 'home_updated', {
			id, data
		});
	}
});
