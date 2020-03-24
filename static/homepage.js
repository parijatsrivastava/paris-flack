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
        if (channelname === data.channel)
        {
            var chat_id = data.chat_id;
            var chatID = chat_id.toString();
            const li = document.createElement('li');
            const header = document.createElement('span');            
            header.innerHTML = data.username + " " + data.time;
            li.append(header);
            const linebreak = document.createElement('br');
            li.append(linebreak);
            const chat_message = document.createElement('span');
            chat_message.innerHTML = data.message;
            li.append(chat_message);
            if (data.username === username)
            {
                const linebreak1 = document.createElement('br');
                li.append(linebreak1);
                const deletelink = document.createElement('a');
                deletelink.innerHTML = "delete";
                deletelink.className = "deletechat";
                deletelink.dataset.chat_id = chatID;
                deletelink.href = `/deletechat/${chatID}`;
                li.append(deletelink);
                li.append(" ");
                const editlink = document.createElement('a');
                editlink.innerHTML = "edit";
                editlink.className = "editchat";
                editlink.dataset.chat_id = chatID;
                editlink.href = `/editchat/${chatID}`;
                li.append(editlink);
            }
            li.className = "wrap_message";
            li.id = chatID;
            var mylist = document.querySelector("#chat_list");
            mylist.insertBefore(li, mylist.childNodes[0]);
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