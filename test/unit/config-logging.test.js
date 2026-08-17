'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | default logger returns serialization errors', async function(){
    const logger = new server.Config().logFunction;
    const circular = {};

    circular.circular = circular;

    await assert.rejects(logger.call({log:'unused'}, circular));
});

test('Unit | default logger returns asynchronous filesystem errors', async function(){
    const logger = new server.Config().logFunction;
    const originalAppendFile = fs.appendFile;

    try{
        fs.appendFile = function(filename, data, encoding, callback){
            callback(new Error('async logging failure'));
        };

        await assert.rejects(
            logger.call({log:'unused'}, {method:'GET'}),
            /async logging failure/
        );
    }finally{
        fs.appendFile = originalAppendFile;
    }
});

test('Unit | default logger returns synchronous filesystem errors', async function(){
    const logger = new server.Config().logFunction;
    const originalAppendFile = fs.appendFile;

    try{
        fs.appendFile = function(){
            throw new Error('sync logging failure');
        };

        await assert.rejects(
            logger.call({log:'unused'}, {method:'GET'}),
            /sync logging failure/
        );
    }finally{
        fs.appendFile = originalAppendFile;
    }
});
