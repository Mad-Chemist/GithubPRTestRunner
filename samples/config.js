//Provide the desired target repo path [USER]/[REPO]
module.exports = {
    REPO_PATH: 'Mad-Chemist/GithubPRTestRunner',
    PACKAGE_PATH: './', //path that contains `package.json`
    TEST_CMD: 'npm run test -- --single-run --reporters dots'
};
