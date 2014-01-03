// Load modules

var Boom = require('boom');
var Hoek = require('hoek');
var Hawk = require('hawk');


// Declare internals

var internals = {};


exports.register = function (plugin, options, next) {

    plugin.auth.scheme('hawk', internals.hawk);
    plugin.auth.scheme('bewit', internals.bewit);
    next();
};


internals.hawk = function (server, options) {

    Hoek.assert(options, 'Invalid hawk scheme options');
    Hoek.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in hawk scheme configuration');

    var settings = Hoek.clone(options);
    settings.hawk = settings.hawk || {};

    var scheme = {
        authenticate: function (request, reply) {

            Hawk.server.authenticate(request.raw.req, settings.getCredentialsFunc, settings.hawk, function (err, credentials, artifacts) {

                return reply(err, { credentials: credentials, artifacts: artifacts });
            });
        },
        authenticatePayload: function (request, callback) {

            callback = Hoek.nextTick(callback);

            var isValid = Hawk.server.authenticatePayload(request.rawPayload, request.auth.credentials, request.auth.artifacts, request.headers['content-type']);

            return callback(isValid ? null : Boom.unauthorized('Payload is invalid'));
        },
        responseHeader: function (request, response, callback) {

            callback = Hoek.nextTick(callback);

            var payloadHash = Hawk.crypto.initializePayloadHash(request.auth.credentials.algorithm, response.headers['content-type']);

            response._header('trailer', 'server-authorization');
            response._header('transfer-encoding', 'chunked');

            response.on('peek', function (chunk) {

                payloadHash.update(chunk);
            });

            response.once('finish', function () {

                var header = Hawk.server.header(request.auth.credentials, request.auth.artifacts, { hash: Hawk.crypto.finalizePayloadHash(payloadHash) });
                if (header) {
                    request.raw.res.addTrailers({ 'server-authorization': header });
                }
            });

            callback();
        }
    };

    return scheme;
};


internals.bewit = function (server, options) {

    Hoek.assert(options, 'Invalid bewit scheme options');
    Hoek.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in bewit scheme configuration');

    var settings = Hoek.clone(options);
    settings.hawk = settings.hawk || {};

    var scheme = {
        authenticate: function (request, reply) {

            Hawk.server.authenticateBewit(request.raw.req, settings.getCredentialsFunc, settings.hawk, function (err, credentials, bewit) {

                return reply(err, { credentials: credentials, artifacts: bewit });
            });
        }
    };

    return scheme;
};

