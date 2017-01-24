var Botkit = require('botkit');

var token = process.env.SLACK_TOKEN

var controller = Botkit.slackbot({
  // reconnect to Slack RTM when connection goes bad
  retry: Infinity,
  debug: false,
  interactive_replies: true
});

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
  console.log('Starting in single-team mode');
  controller.spawn({
    token: token
  }).startRTM(function (err, bot, payload) {
    if (err) {
      throw new Error(err);
    }

    console.log('Connected to Slack RTM');
  });
// Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
  console.log('Starting in Beep Boop multi-team mode');
  require('beepboop-botkit').start(controller, { debug: true });
}

controller.on('bot_channel_join', function (bot, message) {
  bot.reply(message, "I'm here!");
})

var default_occasions_regexp = [
    /(happy birthday){1}\s*(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i,
    /(workiversary){1}\s*(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i,
    /(great job){1}\s*(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i,
    /(congratulations){1}\s*(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i,
    /(thank you){1}\s*(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i
];

controller.hears(default_occasions_regexp, ['ambient'], function(bot, message) {
    console.log(message.text);
    bot.startPrivateConversation(message, function(err, convo) {
        if(!err) {
            point_limit = 500;
            receiver = message.match[0].match(/(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i)[0];
            trigger_phrase = message.match[0].replace(/(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/i, '').trim()
            occasion = trigger_phrase.replace(' ', '_').toLowerCase();
            responses = {
                'editing': false,
                'receiver': receiver,
                'occasion': occasion,
                'trigger_phrase': trigger_phrase
            };
            askTriggerConfirm(convo, responses);
            convo.next();
        } else {
            console.log('ERROR: ', err);
        }
    });
});

controller.on('direct_message', function(bot, message) {
    bot.startConversation(message, function(err, convo) {
        if(!err) {
            point_limit = 500;
            responses = { 'editing': false };
            askRecevier(convo, responses);
            convo.next();
        } else {
            console.log('ERROR: ', err);
        }
    });
});

var askTriggerConfirm = function(convo, responses) {
    convo.say('Hi! I noticed you said ' + trigger_phrase);
    convo.ask({
        attachments: [
            {
                title: 'Would you like to send ' + responses['receiver'] + ' recognition using AnyPerk?',
                callback_id: 'trigger_phrase',
                attachment_type: 'default',
                actions:[
                    {
                        'name': 'yes',
                        'text': 'Yes',
                        'value': 'yes',
                        'type': 'button'
                    },
                    {
                        'name': 'no',
                        'text': 'No',
                        'value': 'no',
                        'type': 'button'
                    }
                ]
            }
        ]
    },
    [
        {
            pattern: 'yes',
            callback: function(response, convo) {
                askPoints(convo, responses);
                convo.next();
            }
        },
        {
            pattern: 'no',
            callback: function(response, convo) {
                askCancelConfirm(convo, responses);
                convo.next();
            }
        }
    ]);
}

var askCancelConfirm = function(convo, responses) {
    convo.ask({
        attachments: [
            {
                title: 'Are you sure? Giving recognition is a great way to boost someone\'s day!',
                callback_id: 'cancel_triggered_message',
                attachment_type: 'default',
                actions: [
                    {
                        'name': 'yes',
                        'text': 'See you next time!',
                        'value': 'yes',
                        'type': 'button'
                    },
                    {
                        'name': 'no',
                        'text': 'I want to send recognition!',
                        'value': 'no',
                        'type': 'button'
                    }
                ]
            }
        ]
    },
    [
        {
            pattern: 'yes',
            callback: function(response, convo) {
                //Do nothing and end convo
                convo.next();
            }
        },
        {
            pattern: 'no',
            callback: function(response, convo) {
                responses['receiver'] = null;
                responses['occasion'] = null;
                askRecevier(convo, responses);
                convo.next();
            }
        }
    ])
}

var askRecevier = function(convo, responses) {
    convo.ask('Hi Tong! Who would you like to recognize today?', [
        {
            pattern: '@someone',
            callback: function(response, convo) {
                responses['receiver'] = response.text;
                askOccasion(convo, responses);
                convo.next();
            }
        },
        {
            default: true,
            callback: function(response, convo) {
                convo.repeat();
            }
        }
    ], {'key': 'recv'});
}

var askOccasion = function(convo, responses) {
    // convo.ask({
    //     attachments: [
    //         {
    //             title: 'Excellent! What is the occasion?',
    //             callback_id: 'occasion',
    //             attachment_type: 'default',
    //             actions: [
    //                 {
    //                     "name": "great_job",
    //                     "text": "Great Job",
    //                     "value": "great_job",
    //                     "type": "button",
    //                 },
    //                 {
    //                     "name": "birthday",
    //                     "text": "Birthday",
    //                     "value": "birthday",
    //                     "type": "button",
    //                 },
    //                 {
    //                     "name": "workiversary",
    //                     "text": "Workiversary",
    //                     "value": "workiversary",
    //                     "type": "button",
    //                 },
    //                 {
    //                     "name": "congratulations",
    //                     "text": "Congratulations",
    //                     "value": "congratulations",
    //                     "type": "button",
    //                 },
    //                 {
    //                     "name": "thank_you",
    //                     "text": "Thank You",
    //                     "value": "thank_you",
    //                     "type": "button",
    //                 }
    //             ]
    //         }
    //     ]
    // },
    // [
    //     {
    //         pattern: 'great_job',
    //         callback: function(response, convo) {
    //             responses["occasion_key"] = "great_job"
    //             responses["occasion"] = "Great Job"
    //             askPoints(convo, responses);
    //             convo.next();
    //         }
    //     },
    //     {
    //         pattern: 'birthday',
    //         callback: function(response, convo) {
    //             console.log('it triggered');
    //             responses["occasion_key"] = "birthday"
    //             responses["occasion"] = "Birthday"
    //             askPoints(convo, responses);
    //             convo.next();
    //         }
    //     },
    //     {
    //         pattern: 'workiversary',
    //         callback: function(response, convo) {
    //             responses["occasion_key"] = "workiversary"
    //             responses["occasion"] = "Workiversary"
    //             askPoints(convo, responses);
    //             convo.next();
    //         }
    //     },
    //     {
    //         pattern: 'congratulations',
    //         callback: function(response, convo) {
    //             responses["occasion_key"] = "congratulations"
    //             responses["occasion"] = "Congratulations"
    //             askPoints(convo, responses);
    //             convo.next();
    //         }
    //     },
    //     {
    //         pattern: 'thank_you',
    //         callback: function(response, convo) {
    //             responses["occasion_key"] = "thank_you"
    //             responses["occasion"] = "Thank You"
    //             askPoints(convo, responses);
    //             convo.next();
    //         }
    //     },
    // ], {"key": "occasion"});
    convo.ask({
        attachments:[
            {
                title: 'Do you want to proceed?',
                callback_id: '123',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"yes",
                        "text": "Yes",
                        "value": "yes",
                        "type": "button",
                    },
                    {
                        "name":"no",
                        "text": "No",
                        "value": "no",
                        "type": "button",
                    }
                ]
            }
        ]
    },[
        {
            pattern: "yes",
            callback: function(reply, convo) {
                convo.say('FABULOUS!');
                convo.next();
                // do something awesome here.
            }
        },
        {
            pattern: "no",
            callback: function(reply, convo) {
                convo.say('Too bad');
                convo.next();
            }
        },
        {
            default: true,
            callback: function(reply, convo) {
                // do nothing
            }
        }
    ]);
}

var askPoints = function(convo, responses){
    convo.say('Okay, great! How many points do you want to give ' + responses['receiver'] + '?');
    convo.say('You have ' + point_limit + ' available points.');
    convo.ask('Please enter the number of points as a numerical value (10, 20, etc.)', [
        {
            pattern: /^[0-9]*\s*(pts|points)?\s*$/,
            callback: function(response, convo) {
                value = parseInt(response.text.match(/\d+/),10)
                if (value > point_limit) {
                    convo.say('You don\'t have enough points');
                    convo.say('Please enter the number of points as a numerical value (10, 20, etc.)');
                    convo.repeat();
                }
                else {
                    responses['amount'] = response.text;
                    askMessage(convo, responses);
                    convo.next();
                }
            }
        },
        {
            default: true,
            callback: function(response, convo) {
                convo.say('Please enter the number of points as a numerical value (10, 20, etc.)');
                convo.repeat();
            }
        }
    ], {'key' : 'amount'});
}

var askMessage = function(convo, responses) {
    convo.say('Let\'s send them a message!');
    if (responses['occasion'] == 'normal') {
        convo.ask('Would you like to use a default message or write your own?', [
            {
                pattern: 'default',
                callback: function(response, convo) {
                    responses['message'] = response.text;
                    askWhoElseShouldKnow(convo, responses);
                    convo.next();
                }
            },
            {
                pattern: 'not_default',
                callback: function(response, convo) {
                    convo.ask('What would you like to say?', function(response, convo) {
                        responses['message'] = response.text;
                        askWhoElseShouldKnow(convo, responses);
                        convo.next();
                    }, { 'key' : 'message' });
                }
            }
        ]);
    }
    else {
        convo.ask('What would you like to say?', function(response, convo) {
            responses['message'] = response.text;
            askWhoElseShouldKnow(convo, responses);
            convo.next();
        }, { 'key' : 'message' });
    }
}

var askWhoElseShouldKnow = function(convo, responses) {
    convo.ask('Who else should know? Please write the name in the form of @Name', [
        {
            pattern: /^\s*(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/,
            callback: function(response, convo) {
                responses['who_else'] = response.text.trim();
                askConfirm(convo, responses);
                convo.next();
            }
        }
    ]);
}

var askConfirm = function(convo, responses) {
    convo.say('Here is your recognition');
    convo.say(responses['receiver'] + ', ' + responses['occasion'] + ', ' + responses['amount'] + ' points');
    convo.say(responses['message']);
    convo.say('Who else should know? ' + responses['who_else']);
    convo.ask('Are you ready to send this recognition?', [
        {
            pattern: 'yes',
            callback: function(response, convo) {
                askWeeklyRoundup(convo, responses);
                convo.next();
            },
            pattern: 'no',
            callback: function(response, convo) {
                askEdit(convo, responses);
                convo.next();
            }
        }
    ]);
}

var askEdit = function(convo, responses) {
    responses['editing'] = true;
    convo.say('now editing... (wip)');
    convo.next();
}


var askWeeklyRoundup = function(convo, responses) {
    convo.ask('Excellent! Would you like to include this in your weekly recognition roundup?', [
        {
            pattern: 'yes',
            callback: function(response, convo) {
                convo.say('Great! I\'ve added you to the roundup!');
                //TODO: ADD THE SEND STEP
                convo.next();
            }
        },
        {
            pattern: 'no',
            callback: function(response, convo) {
                convo.say('No problem! See you next time :)');
                //TODO: ADD THE SEND STEP
                convo.next();
            }
        }
    ]);
}
