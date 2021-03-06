var csvParse = require('csv-parser'),
    fs = require('fs'),
    key = require('./key.js'),
    pg = require('pg').native;

// just k/v for now, geom requires some thinking and UI work

var conString = "postgres://postgres@localhost/tofix";

function connect(callback) {
    var client = new pg.Client(conString);
    client.connect(function(err) {
        if (err) return endClientErr(client, err);
        callback(client);
    });
}

function endClientErr(client, err) {
    client.end();
    return err;
}

function csv(tableName, csvLocation, callback) {
    connect(function(client) {
        client.query("select count(*) from pg_class where relname='" + tableName + "';", function(err, result) {
            if (err) return callback(endClientErr(client, err));
            if (parseInt(result.rows[0].count) < 0) return callback(endClientErr(client, false));

            var create = 'create table ' + tableName + ' (state integer, key text, value text);';
            client.query(create, function(err, result) {
                if (err) return callback(endClientErr(client, err));

                client.query('begin', function(err, result) {
                    if (err) return callback(endClientErr(client, err));
                    var stream = fs.createReadStream(csvLocation).pipe(csvParse());
                    var count = 0;

                    stream.on('data', function(data) {
                        var k = key.hashObject(data);
                        var v = JSON.stringify(data);
                        var insert = "insert into " + tableName + " VALUES(0,$1,$2)";
                        stream.pause();
                        client.query(insert, [k,v], function(err, result) {
                            if (err) return callback(endClientErr(client, err));
                            count = count + 1;
                            stream.resume();
                        });
                    }).on('end', function() {
                        client.query('commit', function(err, result) {
                            if (err) return callback(endClientErr(err));
                            client.end();
                            callback(null, count);
                        });
                    });
                });
            });
        });
    });
}

// going to need special rows for the tables
    // or a special table with metadata about each table?
        // just a single row for each table?
    // tofix_meta
    // authed users, settings and such

module.exports = {
    csv: csv
};
