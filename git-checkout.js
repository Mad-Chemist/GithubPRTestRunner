const spawn = require('child_process').spawn;
const path  = require('path');
let DEBUG = false;
/**
 *
 * @param {{tempDir?, destination, url, head, base, debug?}} options
 * @return {Promise}
 */
function gitCheckoutPR (options) {
    if(options.debug === true) DEBUG = true;
    options.tempDir = options.tempDir || path.resolve(options.destination);

    return clone(options)
        .then(checkoutBase)
        .then(mergeHead)
        .catch((err) => `Error during git checkout: ${err}`)
}

function clone(options) {
	return new Promise((resolve, reject) => {
        if (!options || typeof options.url !== "string" || typeof options.tempDir !== "string") {
            return reject(new Error("Required arguments not provided to clone repo"));
        }

        if(DEBUG) console.log(`Git checkout: ${options.url} to ${options.tempDir}`);

        spawner('git', ['clone', options.url, options.tempDir])
            .on('exit', function (code) {
                    if(code) reject(new Error(`Unable to clone repo : ${code}`));
                    else resolve(options);
                })
	});
}

function checkoutBase(options) {
    return new Promise((resolve, reject) => {
        spawner('git', ['checkout', options.base], { cwd: options.tempDir })
            .on('exit', (code) => {
                if(code) reject(`Unable to checkout base: ${code}`);
                else resolve(options)
            })
	})
}

function mergeHead(options) {
    return new Promise((resolve, reject) => {
        spawner('git', ['merge', options.head], { cwd: options.tempDir })
            .on('exit', (code) => {
                if(code) reject(`Unable to merge head: ${code}`);
                else resolve(options)
            });

    })
}

function spawner(){
    const result = spawn.apply(this, arguments);
    if(DEBUG){
        console.log('spawn called');
        console.log(arguments);
        result.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        result.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
        });
    }

    return result;
}

module.exports = gitCheckoutPR;
