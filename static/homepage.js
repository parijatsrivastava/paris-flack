document.addEventListener('DOMContentLoaded', () => {
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
        let msg = data.message;
        let user = data.username;
        let time = data.time;
        let chat_id = data.chat_id;
        var chatID = chat_id.toString();
        if (channelname === data.channel)
        {
            let chat = user.concat(" ", time, '<br>', msg);
            if (user === username) {
                var text = `<a class="deletechat" data-chat_id="${chatID}" href="/deletechat/${chatID}">delete</a>`;
                var text2 = `<a class="editchat" data-chat_id="${chatID}" href="/editchat/${chatID}">edit</a>`;
                chat = chat.concat(" ", text, " ", text2);
            }
            const li = document.createElement('li');
            li.className = "wrap_message";
            li.id = chatID;
            li.innerHTML = chat;
            var mylist = document.querySelector("#chat_list");
            mylist.insertBefore(li, mylist.childNodes[0]);
        }
    });

    document.querySelectorAll(".deletechat").forEach(link => {
        link.onclick = ()=> {
            let chatid = link.dataset.chat_id;
            document.getElementById(chatid).remove();

            const request = new XMLHttpRequest();            
            request.open('POST', '/delete_chat');            
            request.onload = () => {
                const r = JSON.parse(request.responseText);
                if (!r.success) {
                    document.querySelector("#channel_error").innerHTML = "There was an error. Refresh the page."
                }
            }
            const data = new FormData();
            data.append('chatID', chatid);
            request.send(data);
            
            return false;
        };
    });
    
    
});