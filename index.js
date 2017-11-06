const ACCESS_TOKEN = "<enter access token>";
const REPO_PATH = "<enter repo path>"; //EX: 'Mad-Chemist/GithubPRHooks';
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

const _ = require('underscore');
const github = require('octonode');
const tmp = require('tmp');
const npmRun = require('npm-run');
const checkout = require('./git-checkout');
const karma = require('karma');

const client = github.client(ACCESS_TOKEN);
let ghrepo = client.repo(REPO_PATH);

console.log("====================================");

init();

function init() {
	createLabelIfNeeded(queryPullRequests);
}

function queryPullRequests() {
	ghrepo.prs(function(error, body, headers) {
		if (!handlePossibleError(error) && body && body.length > 0) {
			let latestPR = body[0];
			let ghIssue = client.issue(REPO_PATH, latestPR.number);
			let branchName = latestPR.head.ref;

			addLabelTestingPR(ghIssue);


			//// TESTING karma start DIRECTLY without download
			// let server = new karma.Server({
			//     configFile: "/Users/vicobertogli/Documents/GitHub/Settop-Box/UE.STB/UE.STB/karma.conf.js",
			//     singleRun: true,
			//     urlRoot:"/Users/vicobertogli/Documents/GitHub/Settop-Box/UE.STB/UE.STB/strawberry"
			// }, function() {
			//     console.log("DONE")
			//     console.log(arguments)
			// });

			// server.start();


			//// TESTING karma start after CHECKOUT in TMP directory (some paths below commented out to simulate running tests in current dev environment)
			// tmp.dir(/*{ unsafeCleanup: true },*/ function(error, path, cleanupCallback) {
			// 	console.log(`tmp directory created at - ${path}`);

			// 	if (!handlePossibleError(error)) { // no error
			// 		checkout({
			// 			// url: `${REPO_CHECKOUT_PATH}`,
			// 			url: `https://${ACCESS_TOKEN}:x-oauth-basic@github.com/MusicChoice/Settop-Box.git`,
			// 			// args: ["--branch", branchName],
			// 			destination: path
			// 		}, function(error) {
			// 			if (!handlePossibleError(error)) { // no error
			// 				let specificPath = `${path}/UE.STB/UE.STB`;
			// 				npmRun.exec("npm install", {
			// 					// cwd: path,
			// 					cwd: specificPath
			// 				}, function(error, stdout, stderr) {
			// 					if (!handlePossibleError(error)) {
			// 						console.log("success")
			// 						let server = new karma.Server({
			// 						    configFile: specificPath + '/karma.conf.js',
			// 						    singleRun: true
			// 						}, function() {
			// 						    console.log("DONE")
			// 						    console.log(arguments)
			// 						    cleanupCallback()
			// 						});

			// 						server.start();
			// 					}
			// 					else cleanupCallback

			// 					console.log(stdout, "~~~~~", stderr)
								
			// 				});
			// 			}
			// 			else {
			// 				cleanupCallback();
			// 			}
			// 		});
			// 	}
			// 	else {
			// 		cleanupCallback();
			// 	}
			// });	
		}
	});
}

function addLabelTestingPR(ghIssue) {
	if (ghIssue) {
		ghIssue.addLabels([LABELS.TESTING.name], handlePossibleError);
	}
}

function createLabelIfNeeded(callback) {
	ghrepo.labels(function(error, body, headers) {
		if (!handlePossibleError(error)) { // no error
			let match = _.findWhere(body, LABELS.TESTING);
			if (!match) {
				ghrepo.label(LABELS.TESTING, function(error, body, headers) {
					if (!handlePossibleError(error)) { // no error
						callback();
					}
				});
			}
			else {
				callback();
			}
		}
	});
}

function createCommentOnIssue(issue, comment) {
	if (issue && typeof issue.createComment === "function" && typeof comment === "string") {
		issue.createComment({
			body: comment
		}, handlePossibleError);
	}
}

function handlePossibleError(error) {
	if (error) {
		console.error("ERROR: ")
		console.error("\r\n ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
		console.error(`\r\n ~~~~ ${error} ~~~~`);
		console.error("\r\n ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ \r\n")

		return true;
	}

	return false;
}
