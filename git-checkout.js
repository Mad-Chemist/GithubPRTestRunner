const spawn = require('child_process').spawn;
const path  = require('path');

function download (options, callback) {
	if (!options || typeof options.url !== "string" || typeof options.destination !== "string") {
		return new Error("Required arguments not provided to download function");
	}

	let gitArgs = ['clone', options.url];

	if (options.args && typeof options.args.forEach === "function") {
		options.args.forEach(function(arg) {
			gitArgs.push(arg);
		});
	}

	gitArgs.push(path.resolve(options.destination));

	return spawn('git', gitArgs)
		.on('exit', function (code) {
			if (typeof callback === "function") {
				return code ? callback(new Error(`git exited with code : ${code}`)) : callback(false);
			}
		});
};

module.exports = download;
