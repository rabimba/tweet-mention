var all_tweets = [];
var loaded_users = {};
var total_users = 0;
var template_li;
var user_data = {};
var colours = ['#92C8DA', '#82DA98', '#DAA86D', '#DA5FAC', '#B193DA'];

jQuery(function($) {
    $('p.sorry').hide();

	  $('a.t').click(function() {
        addTweets($(this).text().toLowerCase().replace('@', ''));
        return false;
    });

    $('#show_all,#show_mentions').click(function() {
        // setTimeout trick means we can see any errors
        var el = this;
        setTimeout(function() {
            addTweets($('#users').val(), el.id);
            $('#users').val('');
        });
        return false;
    });
    template_li = $('li:first').clone();
    template_li.find('img').attr('src', 'pixel.gif');
    
    // initialise if there's anything on the query string
    if (window.location.search) {
        var users = window.location.search.match(/users=(.*)/)[1].split(',');
        setTimeout(function () {
            for (var i = 0; i < users.length; i++) {
                addTweets(users[i]);
            }
        });
    }
    
    function addTweets(username, type) {
        username = username.toLowerCase();
        user_data[username] = { 'type' : type || 'show_mentions' };
        if (loaded_users[username]) {
            return; // Don't import someone twice
        }
        var url = (
            'http://twitter.com/statuses/user_timeline/' + 
            username + '.json?count=200&callback=addTweetsToList'
        );
        
        if (user_data[username].latest) {
          url += '&since_id=' + user_data[username].latest;
        }
        
        // Add loading indicators for ALL @username links
        $('.at-' + username.toLowerCase()).addClass('loading');
        // Show the global loading indicator, and increment the refcount
        $('#loading-indicator').show();
        // If it hasn't loaded in 10 seconds, assume something went wrong
        var loadFailedTimout = setTimeout(function() {
            $('#loading-indicator').hide();
            $('.at-' + username.toLowerCase()).removeClass('loading');
            alert('Sorry, could not load tweets for ' + username);
        }, 20 * 1000); // RS upped the limit, because the iPhone takes longer - should really fix in jQuery
        jQuery.getScript(url, function() {
            // Hide the global loading indicator running
            $('#loading-indicator').hide();
            $('.at-' + username.toLowerCase()).removeClass('loading');
            clearTimeout(loadFailedTimout);
        });
    }
    
    window.addTweetsToList = function(tweets) {
      var username = tweets[0].user.screen_name.toLowerCase();

        // Avoid race conditions: ignore if they have been added
        if (loaded_users[username] && tweets[0].id <= user_data[username].latest) {
            return;
        }
        
        user_data[username].latest = tweets[0].id;
        
        if (!loaded_users[username]) {
          user_data[username].colour = colours.pop() || '#fff';
          loaded_users[username] = 1;
          total_users++;
        }
        
        
        // Mark as already imported:
        jQuery.each(tweets, function() {
            all_tweets[all_tweets.length] = this;
        });
        // Now sort the tweets by date
        all_tweets.sort(function(x, y) {
            if (Date.parse(x.created_at) < Date.parse(y.created_at)) {
                return 1;
            } else {
                return -1;
            }
        });
        updateTimeline();
    };
    
    function updateTimeline() {
        // Populate the timeline from the all_tweets array
        var ol = ensureOlExists();
        ol.empty();
        jQuery.each(all_tweets, function() {
            // only show tweet if it mentions one of the names in the list - RS change
            if (user_data[this.user.screen_name.toLowerCase()].type == 'show_mentions') {
              if (total_users < 2) {
                // do nothing and continue
              } else {
                var ok = false;
                for (var sn in loaded_users) {
                    if (this.user.screen_name != sn && this.text.toLowerCase().match('@' + sn.toLowerCase())) {
                        ok = true;
                        break;
                    }
                }
                if (!ok) {
                  return;
                }
              }
            }          
          
            // Turn any http:// in to real links
            var html = this.text.replace(/http:\/\/\S+/g, function(m) {
                return '<a class="ext" href="' + m + '">' + m + '</a>';
            });
            // Turn any @XXX in to links that load yet more tweets
            html = html.replace(/@(\w+)/ig, function(m, n) {
                if (loaded_users[n.toLowerCase()]) {
                    return '@' + n;
                }
                // They get replaced with <a class="t at-natbat">@natbat</a>
                return (
                    '<a class="t at-' + n.toLowerCase() + 
                    '" href="http://twitter.com/' + n + '">@' + n + '</a>'
                );
            });
            // Use any current 'li' as a template
            var li = template_li.clone();
            // if (this.is_new) {
            //     li.addClass('new');
            // }
            
            li.css({ 'backgroundColor' : user_data[this.user.screen_name.toLowerCase()].colour });
            
            // Each tweet li gets e.g. class="t-natbat"
            li.addClass('t-' + this.user.screen_name.toLowerCase());
            li.find('span.msg').html(html).find('a.t').click(function() {
                addTweets($(this).text().toLowerCase().replace('@', ''));
                return false;
            });
            li.find('strong.username').text(this.user.screen_name);
            li.find('img').attr({
                'src': this.user.profile_image_url,
                'alt': this.user.screen_name
            });
            // Add a permalink to the tweet
            li.append(
                ' <a class="permalink" href="http://twitter.com/' +
                this.user.screen_name + '/statuses/' + this.id + '">#</a>'
            );
            li.appendTo(ol);
        });
        updateShowing();
    }
    
    function deleteTweetsFromUser(username) {
        // Delete tweets from username from all_tweets, then redraw
        var new_all_tweets = [];
        $.each(all_tweets, function() {
            if (this.user.screen_name.toLowerCase() != username.toLowerCase()) {
                new_all_tweets[new_all_tweets.length] = this;
            }
        });
        all_tweets = new_all_tweets;
        username = username.toLowerCase();
        delete loaded_users[username];
        colours.push(user_data[username]); // put the colour back on the stack
        delete user_data[username];
        total_users--;
        updateTimeline();
    }
    
    function ensureOlExists() {
        var ol = $('ol');
        if (ol.length) {
            return ol;
        } else {
            return $('<ol></ol>').insertAfter($('p:last'));
        }
    }
    
    function showingClicked(ev) {
        // Event delegation: was a "close" link clicked?
        var target = $(ev.target);
        if (target.hasClass('x')) {
            // They clicked a close link
            var username = target.parent().text().replace('[x]', '');
            deleteTweetsFromUser(username);
        } else if (target.hasClass('r')) {
            // They clicked 'refresh' - not yet implemented
            for (var username in user_data) {
              // console.log(username);
              addTweets(username, user_data[username].type);
            }
        } else {
            return true;
        }
        return false;
    }
    
    function updateShowing() {
        // Add or update the "showing" paragraph
        var p = $('p#showing');
        if (p.length == 0) {
            p = $('<p id="showing"></p>').insertAfter('form:first');
            p.click(showingClicked);
        }
        var bits = [], users = [];
        $.each(loaded_users, function(username) {
            users.push(username);
            bits[bits.length] = (
                '<span>' + username + '<a class="x" href="#">[x]</a></span>'
            );
        });
        var html = '';
        if (bits.length > 2) {
            var last = bits.splice(-1);
            html = bits.join(', ') + ' and ' + last;
        } else {
            html = bits.join(' and ');
        }
        if (html) {
            html = 'Showing ' + html + ' <a href="' + window.location.protocol + '//' + window.location.host + window.location.pathname + '?users=' + users.join(',') + '">permalink</a>'; //' <a href="#" class="r">refresh</a>';
            p.html(html);
            p.show();
        } else {
            p.hide();
        }
    }
});