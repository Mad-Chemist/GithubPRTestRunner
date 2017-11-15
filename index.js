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
        color: "b60205"
    }
};
const {promisify} = require('util');
const _ = require('underscore');
const github = require('octonode');
const tmp = require('tmp');
const npmRun = require('npm-run');
const checkout = require('./git-checkout');
const path = require('path');

const client = github.client(ACCESS_TOKEN);
let ghrepo = client.repo(REPO_PATH);
let GH = {
    getLabels: promisify(ghrepo.labels.bind(ghrepo)),
    addLabel: promisify(ghrepo.label.bind(ghrepo)),
    getPRs: promisify(ghrepo.prs.bind(ghrepo)),
    getIssue: promisify(client.pr.bind(client))
};
let npm = promisify(npmRun.exec);
let activePR;

console.log("====================================");

init();

function init() {
    client.limit(function (err, left, max, reset) {
        console.log(`Client rate limit check ${left}/${max} resets at ${new Date(reset * 1000)}`);
        getLatestPR()
            .then((pr) => activePR = pr)
            .then((pr) => addLabel(pr, LABELS.TESTING.name))
            .then(checkoutPR)
            .then(installDeps)
            .then(runTests)
            .then(() => reportSuccess(activePR))
            .catch((err) => {
                console.error(`Error caught: ${err}`);
                if(err.hasOwnProperty('failures')){
                    reportFailedTests(activePR, err.failures)
                }
            })
    });
}

function getLatestPR() {
    return GH.getPRs()
        .then((body) => {
            return _.find(body, (issue) => issue.hasOwnProperty('base') && issue.hasOwnProperty('head') && issue.state === 'open');
        });
}

function checkoutPR(ghIssue) {
    return new Promise((resolve, reject) => {
        if (!ghIssue || !ghIssue.hasOwnProperty('base')) return reject(`No issue to checkout`);

        tmp.dir(/*{ unsafeCleanup: true },*/ function (error, path) {
            if (error) reject(`Unable to create temp dir: ${error}`);
            else {
                console.log(`Checking out source code from ${ghIssue.base.repo.full_name}/${ghIssue.number} into ${path}`);
                checkout({
                    url: REPO_CHECKOUT_PATH,
                    base: ghIssue.base.sha,
                    head: ghIssue.head.sha,
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
            .then(() => {
                npm("npm install", {
                    cwd: cwd
                })
                    .then(() => resolve(cwd))
                    .catch((err) => reject(`Failed to install dependencies: ${err}`))
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
            if (err) {
                console.log(`ERROR IN TEST CMD: ${err}`);
                let scan = /\((\d+) FAILED\)/;
                if (scan.exec(stderr)) {
                    reject({failures:scan[1]})
                } else {
                    reject(stderr)
                }
            }
            else {
                console.log(stdout);
                resolve(stdout);
            }
        })
    })
}

function reportSuccess(pr) {
    createCommentOnIssue(pr, `Successfully ran tests`)
        .then(removeLabel(pr,LABELS.TESTING.name))
        .then(removeLabel(pr,LABELS.FAIL.name))
        .then(addLabel(pr, LABELS.PASS.name))
}

function reportFailedTests(pr, failureCount) {
    createCommentOnIssue(pr, `Pull request failed ${failureCount} tests`)
        .then(removeLabel(pr,LABELS.TESTING.name))
        .then(removeLabel(pr,LABELS.PASS.name))
        .then(addLabel(pr, LABELS.FAIL.name))
}

function createCommentOnIssue(issue, comment) {
    return new Promise((resolve, reject) => {
            ensureIssueApi(issue).createComment({
                    body: comment
                }, (error) => {
                    if (error) reject(`Unable to add comment ${error}`);
                    else {
                        resolve(issue)
                    }
                });
    })
}

function removeLabel(issue, label) {
    console.log(`Removing label ${label}`);
    return new Promise((resolve, reject) => {
        ensureIssueApi(issue)
            .removeLabel(label, (err) => {
                if(err) reject(`Cannot remove label ${label}`);
                else resolve(issue)
            });
    })
}

function addLabel(issue, label) {
    console.log(`Adding label ${label}`);
    return new Promise((resolve, reject) => {
        ensureIssueApi(issue)
            .addLabels([label], (error) => {
                if (error) {
                    reject(`Unable to add label to PR: ${error}`)
                } else {
                    resolve(issue)
                }
            });
    })
}

function ensureIssueApi(prOrIssue) {
    if(prOrIssue instanceof github.issue) return prOrIssue;
    return new github.issue(REPO_PATH, prOrIssue.number, client)
}