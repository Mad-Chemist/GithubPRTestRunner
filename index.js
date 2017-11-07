const ACCESS_TOKEN = require('./credentials').ACCESS_TOKEN;
const {REPO_PATH, PACKAGE_PATH, TEST_CMD} = require('./config');
const REPO_CHECKOUT_PATH = `https://${ACCESS_TOKEN}:x-oauth-basic@github.com/${REPO_PATH}.git`;

const LABELS = {
	TESTING: {
		name: "TESTING",
		color: "fbca04"
	},
	PASS: {
		name: "PASSES",
		color: "28a745"
	},
	FAIL: {
		name: "FAILURE",
		color: "28a745"
	}
};
const {promisify} = require('util');
const _ = require('underscore');
const github = require('octonode');
const tmp = require('tmp');
const npmRun = require('npm-run');
const checkout = promisify(require('./git-checkout'));
const path = require('path');

const client = github.client(ACCESS_TOKEN);
let ghrepo = client.repo(REPO_PATH);
let GH = {
	getLabels: promisify(ghrepo.labels.bind(ghrepo)),
	addLabel:  promisify(ghrepo.label.bind(ghrepo)),
	getPRs:    promisify(ghrepo.prs.bind(ghrepo))
};
let npm = promisify(npmRun.exec);
let activePR;

console.log("====================================");

init();

function init() {
    client.limit(function (err, left, max, reset) {
        console.log(`Client rate limit check ${left}/${max} resets at ${new Date(reset * 1000)}`);
        createLabelsIfNeeded()
			.then(getLatestPR)
            .then((issue) => activePR = issue)
			.then(addLabelTestingPR)
			.then(checkoutPR)
			.then(installDeps)
			.then(runTests)
			.then(() => reportSuccess(activePR))
			.catch((err) => console.error(`Error caught: ${err}`))
    });
}

function getLatestPR() {
    return GH.getPRs()
        .then((body) => {
            let latestPR = body[0];
            // let ghIssue = latestPR && client.issue(REPO_PATH, latestPR.number);
            let ghIssue = client.issue(REPO_PATH, '398');
            return ghIssue;
        });
}

function addLabelTestingPR(ghIssue) {
	return new Promise((resolve, reject) => {
        if (ghIssue) {
            ghIssue.addLabels([LABELS.TESTING.name], (error) => {
            	if(error){
            		reject(`Unable to add label to PR: ${error}`)
				}else{
            		resolve(ghIssue)
				}
            });
        }else{
        	reject(`No PR to label`);
		}
	})
}

function checkoutPR(ghIssue) {
    return new Promise((resolve, reject) => {
        if(!ghIssue) return reject(`No issue to checkout`);
        
    	tmp.dir(/*{ unsafeCleanup: true },*/ function(error, path, cleanupCallback) {
			if(error) reject(`Unable to create temp dir: ${error}`);
			else{
                console.log(`Checking out source code from ${ghIssue.repo}/${ghIssue.number} into ${path}`);
                checkout({
							// url: `${REPO_CHECKOUT_PATH}`,
							url: `https://${ACCESS_TOKEN}:x-oauth-basic@github.com/MusicChoice/Settop-Box.git`,
							// args: ["--branch", branchName],
							destination: path
				})
					.then(() => resolve(path))
					.catch((error) => reject(`Unable to checkout repo: ${error}`))
			}
        })
	})
}

function installDeps(dir) {
	return new Promise((resolve, reject) => {
        let cwd = path.join(dir, PACKAGE_PATH);
        console.log(`Installing dependencies in ${cwd}`);
        npm("npm set progress=false")
			.then(()=>{
				npm("npm install", {
                    cwd: cwd
                })
				.then(() => resolve(cwd))
            })

		.catch((err) => reject(`Failed to install dependencies: ${err}`))
	})
}
function runTests(dir) {
    return new Promise((resolve, reject) => {
        console.log(`Running tests in ${dir}`);
        npmRun.exec(TEST_CMD, {
            cwd: dir
        }, function (err, stdout, stderr) {
			if(err) {
			    let scan = /\((\d+) FAILED\)/;
                if(scan.exec(stderr)){
			        reject(`${scan[1]} tests have failed`)
                }else {
                    reject(stderr)
                }
            }
			else{
                console.log(stdout);
                resolve(stdout);
			}
        })
    })
}

function reportSuccess(issue) {
    return createCommentOnIssue(issue, `Successfully ran tests`);
}

function createLabelsIfNeeded() {
	return new Promise((resolve, reject) => {
        GH.getLabels()
            .then((body) => {
                let match = _.findWhere(body, LABELS.TESTING);
                if (!match) {
                    GH.addLabel(LABELS.TESTING)
						.then(resolve)
						.catch(reject)
                }
                else {
                    resolve();
                }
            })
            .catch((err) => reject(`ghrepo.labels ${err}`));
	})
}

function createCommentOnIssue(issue, comment) {
	return new Promise((resolve, reject) => {
	    if (issue && typeof issue.createComment === "function" && typeof comment === "string") {
            issue.createComment({
                body: comment
            }, (error) => {
                if(error) reject(`Unable to add comment ${error}`);
                else{
                    resolve(issue)
                }
            });
        }else{
	        reject(`Unable to add comment`)
        }
    })
}