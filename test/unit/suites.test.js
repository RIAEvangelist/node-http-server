'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const suites = require('../suites.js');

test('Unit | suite discovery exposes the four selectable categories', function(){
    assert.deepEqual(suites.categories, [
        'unit',
        'functional',
        'integration',
        'regression'
    ]);
});

test('Unit | suite discovery returns unique test files from every category', function(){
    const files = suites.filesForCategories();

    assert.equal(files.length > 0, true);
    assert.equal(new Set(files).size, files.length);
    for(const category of suites.categories){
        const directory = path.join('test', category) + path.sep;

        assert.equal(files.some(function(filename){
            return filename.includes(directory);
        }), true);
    }
});

test('Unit | suite discovery rejects unknown or repeated categories', function(){
    assert.throws(
        function(){
            suites.filesForCategories(['unknown']);
        },
        /Unknown test category/
    );
    assert.throws(
        function(){
            suites.filesForCategories(['unit', 'unit']);
        },
        /categories must be unique/
    );
});
