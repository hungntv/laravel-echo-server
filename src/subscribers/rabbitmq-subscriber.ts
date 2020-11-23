//var Redis = require('ioredis');

import { Log } from './../log';
import { Subscriber } from './subscriber';

export class RabbitmqSubscriber implements Subscriber {
    /**
     * Redis pub/sub client.
     *
     * @type {object}
     */
    // private _redis: any;
    private _amqp: any;

    /**
     *
     * KeyPrefix for used in the redis Connection
     *
     * @type {String}
     */
    private _keyPrefix: string;

    /**
     * Create a new instance of subscriber.
     *
     * @param {any} options
     */
    constructor(private options) {
        this._keyPrefix = options.databaseConfig.redis.keyPrefix || '';
        // this._redis = new Redis(options.databaseConfig.redis);
    }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {Promise<any>}
     */
    subscribe(callback): Promise<any> {
        //đăng ký all channel/topic
        this._amqp = require('amqplib/callback_api');
        return new Promise((resolve, reject) => {
            //hungntv
            //can dung dynamic config truyen vao tham so localhost ben duoi
            //chu y: khi phat sinh error, chi call reject, 
            //       ko call return, cac doan lenh sau do van co the chay tiep.
            //       Lý do: code gốc khi tương tác với redis cũng hành xử như vậy
            //              nên hiện tại port y chang. nếu code gốc thay đổi thì
            //              ta cần port lại
            this._amqp.connect('amqp://localhost', function(error0, connection) {
                if (error0) {
                    Log.error('RabbitMQ could not connect. Error' + error0);
                    reject('RabbitMQ could not connect. Error' + error0);
                }
                connection.createChannel(function(error1, channel) {
                    if (error1) {
                        reject('RabbitMQ could not create channel. Error: ' + error1);
                    }
                    var exchange = 'exchange_name';

                    channel.assertExchange(exchange, 'topic', {
                        durable: false
                    });

                    channel.assertQueue('', {exclusive: true}, function(error2, q) {
                        if (error2) {
                            reject('RabbitMQ could not assert Queue. Error:' + error2);
                        }
                        channel.bindQueue(q.queue, exchange, '#');//# is all
                        channel.consume(q.queue, function(msg) {
                            console.log(" [x] %s:'%s'", msg.fields.routingKey, msg.content.toString());

                            var topic = msg.fields.routingKey;//as redis channel
                            try {
                                var messageObj = JSON.parse(msg.content);
                                // if (this.options.devMode) {
                                    Log.info("Channel: " + topic);
                                    Log.info("Event: " + messageObj.event);
                                    Log.info("EventRaw: " + msg.content);
                                // }
                                callback(topic, messageObj);
                            } catch (e) {
                                // if (this.options.devMode) {
                                    Log.info("Err: " + e.toString());
                                // }
                            }
                        }, {
                            noAck: true
                        });

                        Log.success('Listening for redis events...');
                        resolve();
                    });
                });
            });
        });

        // return new Promise((resolve, reject) => {
        //     this._redis.on('pmessage', (subscribed, channel, message) => {
        //         try {
        //             var msgRaw = message;
        //             message = JSON.parse(message);

        //             if (this.options.devMode) {
        //                 Log.info("Channel: " + channel);
        //                 Log.info("Event: " + message.event);
        //                 Log.info("EventRaw: " + msgRaw);
        //                 Log.info("Subscribed: " + subscribed);
        //             }

        //             callback(channel.substring(this._keyPrefix.length), message);
        //         } catch (e) {
        //             if (this.options.devMode) {
        //                 Log.info("No JSON message");
        //             }
        //         }
        //     });

        //     //subscribe all topic/channel
        //     this._redis.psubscribe(`${this._keyPrefix}*`, (err, count) => {
        //         if (err) {
        //             reject('Redis could not subscribe.')
        //         }

        //         Log.success('Listening for redis events...');

        //         resolve();
        //     });
        // });
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise}
     */
    unsubscribe(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                // this._redis.disconnect();
                this._amqp = null
                resolve();
            } catch(e) {
                reject('Could not disconnect from redis -> ' + e);
            }
        });
    }
}