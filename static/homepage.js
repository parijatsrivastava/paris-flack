
var title_text = document.querySelector("#homepage_title").innerHTML;
var msg_count = 1;
document.addEventListener('DOMContentLoaded', () => {
    const list_template = Handlebars.compile(document.querySelector('#message_li').innerHTML);    
    var channelname;
    var username;
    const request = new XMLHttpRequest();
    request.open('GET', '/if_channel');
    request.send();        
    request.onload = () => {
        var resp = JSON.parse(request.responseText);
        channelname = resp.channel;
        username = resp.username;
        if (!channelname || !username) {
            document.querySelector("#chat_button").disabled = true;
            document.querySelector("#channel_error").innerHTML = "Select A Channel First";            
        }
        else {
            document.querySelector("#chat_button").disabled = false;
            document.querySelector("#channel_error").innerHTML = "";
        }            
    }
    
    // Connect to websocket
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    // When connected, configure buttons
    socket.on('connect', () => {

        document.querySelector("#chat_button").onclick = () => {
            let message = document.querySelector("#chat_message").value;
            if (message.length <= 0) {
                alert("Type a Message");
                return false;
            } else {
                socket.emit('submit chat', {'message': message, "channel": channelname, "username": username});
                document.querySelector("#chat_message").value = '';
            }
        };        
    });
    
    socket.on('receive chat', data => {
        if (channelname === data.channel)
        {
            var chat_id = data.chat_id;
            var chatID = chat_id.toString();
            var currentuser;

            if (data.username === username) {
                currentuser = true;
            } else {
                currentuser = false;
                document.querySelector("#homepage_title").innerHTML = `${title_text} (${msg_count})`;
                msg_count = msg_count + 1;
            }

            let li = list_template({'username': data.username, 'time': data.time, 'chat_id': chatID, 'currentuser': currentuser, 'message': data.message});
            let mylist = document.querySelector("#chat_list").innerHTML;
            li += mylist;
            document.querySelector("#chat_list").innerHTML = li;        
        }
    });
    
    socket.on('connect', () => {
        document.querySelectorAll(".deletechat").forEach(link => {
            link.onclick = ()=> {
                let chatid = link.dataset.chat_id;
                socket.emit('delete chat', {'chat_id': chatid});
                return false;
            };
        });        
    });

    socket.on('deleted chat', data => {
        if (data.success) {
            document.getElementById(data.chat_id).remove();
        } else {
            document.querySelector("#channel_error").innerHTML = "There was an error. Refresh the page."
        }
    });
});

window.onclick = ()=>{
    document.querySelector("#homepage_title").innerHTML = title_text;
    msg_count = 1;
};