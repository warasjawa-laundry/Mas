exports.unstable_rethrow = require('next/dist/client/components/unstable-rethrow.browser.js').unstable_rethrow;
exports.useRouter = () => ({push: destination => window.location.assign(destination), refresh() {}});
