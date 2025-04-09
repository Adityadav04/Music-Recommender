# 🎵 Spotify AI Music Recommender

An AI-powered web application that connects with Spotify to analyze your listening history and provide personalized music recommendations using K-means clustering.

![Dashboard Screenshot](public/img/preview-dashboard.png)

---

## 🚀 Features

- 🔐 **Login with Spotify**: OAuth2-based authentication
- 🤖 **AI-Powered Recommendations**: Uses clustering to suggest songs based on user preferences
- 🎧 **Top Tracks Display**: View your current most-played songs
- 🌐 **Modern Web Interface**: Built using Bootstrap & EJS templates
- 🔁 **Session Management**: Keeps users logged in with `express-session`

---

## 🛠️ Tech Stack

| Layer       | Tools Used                                                                  |
|-------------|-----------------------------------------------------------------------------|
| Backend     | Node.js, Express, Spotify Web API, dotenv                                   |
| Frontend    | EJS, Bootstrap 5, Custom CSS                                                |
| AI Logic    | K-means clustering (`kmeans-js` or `ml-kmeans`)                             |
| Auth & API  | Spotify OAuth2, `spotify-web-api-node`                                      |
| Session     | `express-session`                                                           |

---

## 📦 Installation

```bash
git clone https://github.com/your-username/spotify-ai-recommender.git
cd spotify-ai-recommender
npm install
