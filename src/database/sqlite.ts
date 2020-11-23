let sqlite3;
import { DatabaseDriver } from './database-driver';
try {
    sqlite3 = require('sqlite3');
} catch (e) { }

export class SQLiteDatabase implements DatabaseDriver {
    /**
     * SQLite client.
     */
    private _sqlite: any;

    //require('amqplib/callback_api')
    private _amqp: any;

    /**
     * Create a new cache instance.
     */
    constructor(private options) {
        if (!sqlite3) return;

        this._amqp = require('amqplib/callback_api');

        let path = process.cwd() + options.databaseConfig.sqlite.databasePath;
        this._sqlite = new sqlite3.cached.Database(path);
        this._sqlite.serialize(() => {
            this._sqlite.run('CREATE TABLE IF NOT EXISTS key_value (key VARCHAR(255), value TEXT)');
            this._sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS key_index ON key_value (key)');
        });
    }

    /**
     * Retrieve data from redis.
     */
    get(key: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this._sqlite.get("SELECT value FROM key_value WHERE key = $key", {
                $key: key,
            }, (error, row) => {
                if (error) {
                    reject(error);
                }

                let result = row ? JSON.parse(row.value) : null;

                resolve(result);
            });
        });
    }

    /**
     * Store data to cache.
     */
    set(key: string, value: any): void {
        this._sqlite.run("INSERT OR REPLACE INTO key_value (key, value) VALUES ($key, $value)", {
            $key: key,
            $value: JSON.stringify(value)
        });

        //port tu method set cua class RedisDatabase
        if (this.options.databaseConfig.publishPresence === true && /^presence-.*:members$/.test(key)) {
            this._amqp.connect('amqp://localhost', function(error0, connection) {
                if (error0) {
                    throw error0;
                }
                connection.createChannel(function(error1, channel) {
                    if (error1) {
                    throw error1;
                    }
                    var exchange = 'exchange_name';//cần khớp với bên nhận, search 'exchange_name' để xem
                    
                    var msg = JSON.stringify({
                        "event": {
                            "channel": key,
                            "members": value
                        }
                    });

                    channel.assertExchange(exchange, 'topic', {
                        durable: false
                    });
                    channel.publish(exchange, 'PresenceChannelUpdated', Buffer.from(msg));
                    console.log(" [x] Sent %s:'%s'", key, msg);
                });

                setTimeout(function() { 
                    connection.close(); 
                    process.exit(0) 
                }, 500);
            });
        }
    }
}
