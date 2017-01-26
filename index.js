var Botkit = require('botkit');

var token = process.env.SLACK_TOKEN

var PORT = process.env.port || 8080

var VERIFY_TOKEN = process.env.SLACK_VERIFY_TOKEN

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
  require('beepboop-botkit').start(controller, { debug: false });
}

controller.setupWebserver(PORT, function (err, webserver) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    controller.createWebhookEndpoints(webserver);
})

controller.on('bot_channel_join', function (bot, message) {
  bot.reply(message, "I'm here!");
})

var checkTriggerPhrase = function(message) {
    trigger_regexp = {
        "great_job": /good job|great job|awesome job|great work/i,
        "happy_birthday": /happy birthday|happy bday|hbd/i,
        "workiversary": /happy anniversary|happy work anniversary|workiversary/i,
        "congratulations": /congrats|congratulations/i,
        "thank_you": /thanks|thank you|thx/i
    };


    receiver = message.match[0].match(/<@[A-Za-z0-9-_.]{1,21}>/i);
    if(!receiver) {
        return null;
    }

    message_no_punctuation = message.match[0].replace(/[!.,?]/g, '');
    if(trigger_regexp["great_job"].test(message_no_punctuation)) {
        responses = {
            'occasion': 'Great Job',
            'occasion_key': 'great_job',
            'trigger_phrase': message_no_punctuation.match(trigger_regexp["great_job"])[0]
        }
    } else if(trigger_regexp["happy_birthday"].test(message_no_punctuation)) {
        responses = {
            'occasion': 'Happy Birthday',
            'occasion_key': 'happy_birthday',
            'trigger_phrase': message_no_punctuation.match(trigger_regexp["happy_birthday"])[0]
        }
    } else if(trigger_regexp["workiversary"].test(message_no_punctuation)) {
        responses = {
            'occasion': 'Workiversary',
            'occasion_key': 'workiversary',
            'trigger_phrase': message_no_punctuation.match(trigger_regexp["workiversary"])[0]
        }
    } else if(trigger_regexp["congratulations"].test(message_no_punctuation)) {
        responses = {
            'occasion': 'Congratulations',
            'occasion_key': 'congratulations',
            'trigger_phrase': message_no_punctuation.match(trigger_regexp["congratulations"])[0]
        }
    } else if(trigger_regexp["thank_you"].test(message_no_punctuation)) {
        responses = {
            'occasion': 'Thank You',
            'occasion_key': 'thank_you',
            'trigger_phrase': message_no_punctuation.match(trigger_regexp["thank_you"])[0]
        }
    } else {
        return null;
    }

    responses["receiver"] = receiver[0];
    return responses;
}

controller.hears([/.*<@[A-Za-z0-9-_.]{1,21}.*>.*/], ['ambient'], function(bot, message) {
    console.log('activated');
    responses = checkTriggerPhrase(message);
    if(responses) {
        bot.startPrivateConversation(message, function(err, convo) {
            if(!err) {
                point_limit = 5000;
                askTriggerConfirm(convo, responses);
            } else {
                console.log('ERROR: ', err);
            }
        });
    }
});

controller.on('direct_message', function(bot, message) {
    bot.startConversation(message, function(err, convo) {
        if (!err) {
            point_limit = 5000;
            responses = { 'editing': false };
            askReceiver(convo, responses);
        }
    });
});

var askTriggerConfirm = function(convo, responses) {
    convo.say('Hi! I noticed you said ' + responses["trigger_phrase"]);
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
                convo.say("Bye!");
                convo.stop();
            }
        },
        {
            pattern: 'no',
            callback: function(response, convo) {
                responses['receiver'] = null;
                responses['occasion'] = null;
                askReceiver(convo, responses);
                convo.next();
            }
        }
    ]);
}

var askReceiver = function(convo, responses) {
    isEditing = responses['editing'];
    convo.ask('Hi Tong! Who would you like to recognize today?', [
        {
            pattern: /(<@){1}[A-Za-z0-9-_.]{1,21}>{1}/,
            callback: function(response, convo) {
                responses['receiver'] = response.text;
                if(isEditing){
                    responses['editing'] = false;
                    askConfirm(convo, responses);
                } else {
                    askOccasion(convo, responses);
                }
                convo.next();
            }
        },
        {
            default: true,
            callback: function(response, convo) {
                convo.repeat();
                convo.next();
            }
        }
    ], {'key': 'recv'});
}

var askOccasion = function(convo, responses) {
    isEditing = responses['editing'];
    convo.ask({
        attachments: [
            {
                title: 'Excellent! What is the occasion?',
                callback_id: 'occasion',
                attachment_type: 'default',
                actions: [
                    {
                        "name": "great_job",
                        "text": "Great Job",
                        "value": "great_job",
                        "type": "button",
                    },
                    {
                        "name": "happy_birthday",
                        "text": "Happy Birthday",
                        "value": "happy_birthday",
                        "type": "button",
                    },
                    {
                        "name": "workiversary",
                        "text": "Workiversary",
                        "value": "workiversary",
                        "type": "button",
                    },
                    {
                        "name": "congratulations",
                        "text": "Congratulations",
                        "value": "congratulations",
                        "type": "button",
                    },
                    {
                        "name": "thank_you",
                        "text": "Thank You",
                        "value": "thank_you",
                        "type": "button",
                    }
                ]
            }
        ]
    },
    [
        {
            pattern: 'great_job',
            callback: function(response, convo) {
                responses["occasion_key"] = "great_job"
                responses["occasion"] = "Great Job"
                convo.next();
            }
        },
        {
            pattern: 'birthday',
            callback: function(response, convo) {
                responses["occasion_key"] = "happy_birthday"
                responses["occasion"] = "Happy Birthday"
                convo.next();
            }
        },
        {
            pattern: 'workiversary',
            callback: function(response, convo) {
                responses["occasion_key"] = "workiversary"
                responses["occasion"] = "Workiversary"
                convo.next();
            }
        },
        {
            pattern: 'congratulations',
            callback: function(response, convo) {
                responses["occasion_key"] = "congratulations"
                responses["occasion"] = "Congratulations"
                convo.next();
            }
        },
        {
            pattern: 'thank_you',
            callback: function(response, convo) {
                responses["occasion_key"] = "thank_you"
                responses["occasion"] = "Thank You"
                convo.next();
            }
        }
    ], {"key": "occasion"});

    if(isEditing) {
        responses['editing'] = false;
        askConfirm(convo, responses);
    } else {
        askPoints(convo, responses);
    }
}

var askPoints = function(convo, responses){
    isEditing = responses['editing'];
    convo.say('Okay, great! How many points do you want to give ' + responses['receiver'] + '?');
    convo.say('You have ' + point_limit + ' available points.');
    convo.ask('Please enter the number of points as a numerical value (10, 20, etc.)', [
        {
            pattern: /^[0-9]*\s*(pts|points)?\s*$/,
            callback: function(response, convo) {
                value = parseInt(response.text.match(/\d+/),10)
                if (value > point_limit) {
                    convo.say('You don\'t have enough points');
                    convo.repeat();
                    convo.next();
                }
                else {
                    responses['amount'] = response.text;
                    if(isEditing) {
                        responses['editing'] = false;
                        askConfirm(convo, responses);
                        convo.next();
                    } else {
                        askMessage(convo, responses);
                        convo.next();
                    }
                }
            }
        },
        {
            default: true,
            callback: function(response, convo) {
                convo.say('Please enter the number of points as a numerical value (10, 20, etc.)');
                convo.repeat();
                convo.next();
            }
        }
    ], {'key' : 'amount'});
}

var askMessage = function(convo, responses) {
    isEditing = responses['editing'];
    convo.say('Let\'s send them a message!');
    defaults = ['great_job', 'happy_birthday', 'workiversary', 'congratulations', 'thank_you'];
    if (defaults.indexOf(responses['occasion_key']) > -1) {
        convo.ask({
            attachments: [
              {
                  title: 'Excellent! Would you like to use a default message?',
                  callback_id: 'message',
                  attachment_type: 'default',
                  actions: [
                      {
                          "name": "yes",
                          "text": "Yes",
                          "value": "yes",
                          "type": "button",
                      },
                      {
                          "name": "no",
                          "text": "No",
                          "value": "no",
                          "type": "button",
                      },
                  ]
              }
            ]
        },
        [
            {
                pattern: 'yes',
                callback: function(response, convo) {
                    console.log(responses);
                    occasion = responses['occasion'];
                    if(occasion == "Thank You") {
                        responses['message'] = "Thank you default message";
                    }
                    else if(occasion == "Congratulations") {
                        responses['message'] = "Congratulations default message";
                    }
                    else if(occasion == "Workiversary") {
                        responses['message'] = "Workiversary default message";
                    }
                    else if(occasion == "Happy Birthday") {
                        responses['message'] = "Birthday default message";
                    }
                    else if(occasion == "Great Job") {
                        responses['message'] = "Great Job default message"
                    }
                    if(isEditing) {
                        responses['editing'] = false;
                        askConfirm(convo, responses);
                    } else {
                        askWhoElseShouldKnow(convo, responses);
                    }
                    convo.next();
                }
            },
            {
                pattern: 'no',
                callback: function(response, convo) {
                    convo.ask('What would you like to say?', function(response, convo) {
                        responses['message'] = response.text;
                        if(isEditing) {
                            responses['editing'] = false;
                            askConfirm(convo, responses);
                        } else {
                            askWhoElseShouldKnow(convo, responses);
                        }
                        convo.next();
                    }, { 'key' : 'message' });
                    convo.next();
                }
            }
        ]);
    }
    else {
        convo.ask('What would you like to say?', function(response, convo) {
            responses['message'] = response.text;
            if(isEditing) {
                responses['editing'] = false;
                askConfirm(convo, responses);
            } else {
                askWhoElseShouldKnow(convo, responses);
            }
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
            },

        },
        {
            default: true,
            callback: function(response, convo) {
                convo.say('I\'m sorry! I don\'t recognize that name.');
                convo.repeat();
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
    convo.ask({
        attachments: [
            {
                title: 'Are you ready to send this recognition?',
                callback_id: 'confirm',
                attachment_type: 'default',
                actions: [
                    {
                        'name': 'yes',
                        'text': 'Yes',
                        'value': 'yes',
                        'type': 'button',
                    },
                    {
                        'name': 'no',
                        'text': 'No',
                        'value': 'no',
                        'type': 'button',
                    },
                ]
            }
        ]
    },
    [
        {
            pattern: 'yes',
            callback: function(response, convo) {
                askWeeklyRoundup(convo, responses);
                convo.next();
            }
        },
        {
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
    convo.ask({
        attachments: [
            {
                title: 'What would you like to change?',
                callback_id: 'editing',
                attachment_type: 'default',
                actions: [
                    {
                        'name': 'occasion',
                        'text': 'Occasion',
                        'value': 'occasion',
                        'type': 'button',
                    },
                    {
                        'name': 'name',
                        'text': 'Name',
                        'value': 'name',
                        'type': 'button',
                    },
                    {
                        'name': 'points',
                        'text': 'Points',
                        'value': 'points',
                        'type': 'button',
                    },
                    {
                        'name': 'who_else',
                        'text': 'Who Else Should Know',
                        'value': 'who_else',
                        'type': 'button',
                    },
                    {
                        'name': 'message',
                        'text': 'Message',
                        'value': 'message',
                        'type': 'button',
                    },
                    {
                        'name': 'complete',
                        'text': 'Everything Looks Good',
                        'value': 'complete',
                        'type': 'button',
                    }
                ]
            }
        ]
    },
    [
        {
            pattern: 'occasion',
            callback: function(response, convo) {
                askOccasion(convo, responses);
                convo.next();
            }
        },
        {
            pattern: 'name',
            callback: function(response, convo) {
                askReceiver(convo, responses);
                convo.next();
            }
        },
        {
            pattern: 'points',
            callback: function(response, convo) {
                askPoints(convo, responses);
                convo.next();
            }
        },
        {
            pattern: 'who_else',
            callback: function(response, convo) {
                askWhoElseShouldKnow(convo, responses);
                convo.next();
            }
        },
        {
            pattern: 'message',
            callback: function(response, convo) {
                askMessage(convo, responses);
                convo.next();
            }
        },
        {
            pattern: 'complete',
            callback: function(response, convo) {
                responses['editing'] = false;
                askWeeklyRoundup(convo, responses);
                convo.next();
            }
        }
    ]);
}


var askWeeklyRoundup = function(convo, responses) {
    console.log('ok here');
    convo.ask({
        attachments: [
            {
                title: "Excellent! Would you like to include this in your weekly recognition roundup?",
                callback_id: 'weekly_roundup',
                attachment_type: 'defualt',
                actions: [
                    {
                        'name': 'yes',
                        'text': 'Yes',
                        'value': 'yes',
                        'type': 'button',
                    },
                    {
                        'name': 'no',
                        'text': 'No',
                        'value': 'no',
                        'type': 'button',
                    },
                ]
            }
        ]
    },
    [
        {
            pattern: 'yes',
            callback: function(response, convo) {
                responses['roundup'] = true;
                convo.say('Great! I\'ve added you to the roundup!');
                //TODO: ADD THE SEND STEP
                convo.next();
            }
        },
        {
            pattern: 'no',
            callback: function(response, convo) {
                responses['roundup'] = false;
                convo.say('No problem! See you next time :)');
                //TODO: ADD THE SEND STEP
                convo.next();
            }
        }
    ]);
}
