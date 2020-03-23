import os

from flask import Flask, session, render_template, url_for, redirect, request, jsonify
from flask_socketio import SocketIO, emit
from models import *
from flask_session import Session
from helpers import validate_email, validate_password, validate_username, sendmail
from werkzeug.security import check_password_hash, generate_password_hash
import random
import requests
from datetime import datetime

app = Flask(__name__)

app.config["SESSION_PERMANENT"] = True
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)


@app.route("/", methods=["POST", "GET"])
def index():
    if session.get("username") == None:
        return redirect("/login")
    allchannels = Channel.query.order_by(Channel.name).all()
    
    if session.get("channelname") == None:
        session["channelname"] = None
        chats_current_channel = None
    else:
        chats_current_channel = Chat.query.filter_by(channelname=session["channelname"]).order_by(Chat.time.desc()).limit(100).all()
    
    if request.method == "GET":        
        return render_template("homepage.html", username=session["username"], channelname=session["channelname"], allchannels=allchannels, chats_current_channel=chats_current_channel)


@app.route("/createchannel", methods=["POST", "GET"])
def createchannel():
    if session.get("username") == None:
        return redirect("/login")
    if request.method == "GET":
        return render_template("createchannel.html", username=session["username"])
    
    channelname = request.form.get("channelname")
    channelname = channelname.strip()
    if not channelname:
        return render_template("createchannel.html", username=session["username"], create_channel_error="Type a Channel Name")
    channelname = channelname.strip()
    c = Channel.query.filter_by(name=channelname).first()
    if c == None:
        c = Channel(name=channelname, username=session["username"])
        db.session.add(c)
        db.session.commit()
        session["channelname"] = channelname
        return redirect("/")
    else:
        return render_template("createchannel.html", username=session["username"], create_channel_error="Type a Different Channel Name")


@app.route("/editchat/<int:chat_id>", methods=["POST", "GET"])
def editchat(chat_id):
    if session.get("username") == None:
        return redirect("/login")

    try:
        chat_id = int(chat_id)
    except:
        return redirect("/")

    c = Chat.query.get(chat_id)
    if c == None:
        return redirect("/")
    if c.username != session["username"]:        
        return redirect("/")
    
    if request.method == "GET":
        return render_template("editchat.html", username=session["username"], chat=c)
    
    chat_message = request.form.get("chat_message")
    if not chat_message:
        return render_template("editchat.html", username=session["username"], chat=c, editchat_error="Type a Message")
    c.message = chat_message
    time = datetime.now()
    c.time = time
    db.session.commit()
    return redirect("/")



@app.route("/deletechat/<int:chat_id>")
def deletechat(chat_id):
    if session.get("username") == None:
        return redirect("/login")

    try:
        chat_id = int(chat_id)
    except:
        return redirect("/")

    c = Chat.query.get(chat_id)
    if c == None:
        return redirect("/")

    if c.username != session["username"]:        
        return redirect("/")
    db.session.delete(c)
    db.session.commit()
    return redirect("/")


@app.route("/changechannel/<string:channelname>")
def changechannel(channelname):
    if session.get("username") == None:
        return redirect("/login")
    session["channelname"] = channelname
    return redirect("/")




@app.route("/login", methods=["POST", "GET"])
def login():
    if session.get("username") != None:
        return redirect("/")
    
    session.clear()    
    if request.method == "GET":
        return render_template("login.html")

    username = request.form.get("username")
    password = request.form.get("password")

    if not username or not password:
        return render_template("login.html", login_error="enter username/email and password")
    
    username = username.strip()
    user = User.query.filter_by(username=username).first()
    if user == None:
        user = User.query.filter_by(email=username).first()
        if user == None:
            return render_template("login.html", login_error="Incorrect Username or Email")
    
    if check_password_hash(user.password, password):
        session["username"] = user.username
        session.permanent = True
        return redirect("/")
    else:
        return render_template("login.html", login_error="Incorrect Password")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")


@app.route("/register", methods=["POST", "GET"])
def register():
    if session.get("username") != None:
        return redirect("/")
    session.clear()

    if request.method == "GET":
        return render_template("register.html")
    
    username = request.form.get("username")
    password = request.form.get("password")
    password1 = request.form.get("password1")
    email = request.form.get("email")

    if not username or not password or not email or not password1:
        return render_template("register.html", register_error="Input in all fields marked with *.")

    if not validate_email(email):
        return render_template("register.html", register_error="Invalid Email Address")

    if not validate_password(password):
        return render_template("register.html", register_error="Alpha-numeric Password Required")
    
    if password != password1:
        return render_template("register.html", register_error="Passwords Don't Match")
    
    if not validate_username(username):
        return render_template("register.html", register_error="Invalid Username")

    username = username.strip()
    password = password.strip()
    email = email.strip()

    user = User.query.filter_by(username=username).first()
    if user != None:
        return render_template("register.html", register_error="This Username already exists.")
    user = User.query.filter_by(email=email).first()
    if user != None:
        return render_template("register.html", register_error="This Email is associated with another account.")

    password = generate_password_hash(password)
    code = str(random.randint(100000, 999999))
    session["user_registration"] = {"username": username, "password": password, "email": email, "code": code}
    try:
        sendmail(email, "Verify Email", code)
    except:
        return redirect("/process_verification")
    return redirect("/verification")


@app.route("/verification", methods=["POST", "GET"])
def verification():
    if session.get("user_registration") == None:
        return redirect("/")
    
    if request.method == "GET":
        return render_template("verification.html", email=session["user_registration"]["email"])
    
    code = request.form.get("code")
    if not code:
        return render_template("verification.html", email=session["user_registration"]["email"], verification_error="enter verification code")
    if code != session["user_registration"]["code"]:
        return render_template("verification.html", email=session["user_registration"]["email"], verification_error="incorrect verification code")
    return redirect("/process_verification")


@app.route("/resend_verification_code")
def resend_verification_code():
    if session.get("user_registration") == None:
        return redirect("/")
    
    code = str(random.randint(100000, 999999))
    session["user_registration"]["code"] = code
    try:
        sendmail(session["user_registration"]["email"], "Verify Email", code)
    except:
        return redirect("/process_verification")
    return redirect("/verification")

@app.route("/process_verification")
def process_verification():
    if session.get("user_registration") == None:
        return redirect("/")

    user = User(email=session["user_registration"]["email"], password=session["user_registration"]["password"], username=session["user_registration"]["username"])
    db.session.add(user)
    db.session.commit()
    try:
        sendmail(session["user_registration"]["email"], "Registration Successful", "Thankyou for registering with paris-flack.")
    except:
        pass
    session.clear()
    return redirect("/login")


@app.route("/if_channel")
def if_channel():
    res = {}
    if session.get("channelname") == None:
        res["channel"] = False
    else:
        res["channel"] = session["channelname"]

    if session.get("username") == None:
        res["username"] = False
    else:
        res["username"] = session["username"]

    return jsonify(res)


@socketio.on("submit chat")
def chat(data):
    message = data["message"]
    channel = data["channel"]
    username = data["username"]
    time = datetime.now()
    c = Chat(message=message, username=username, time=time, channelname=channel)
    db.session.add(c)
    db.session.commit()
    c = Chat.query.filter_by(username=username).filter_by(channelname=channel).filter_by(time=time).first()
    mychat = {"message": message, "channel": channel, "username": username, "time": str(time), "chat_id": c.id}
    emit("receive chat", mychat, broadcast=True)