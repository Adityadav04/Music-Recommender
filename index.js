// index.js - Main application file with improved authentication

// Required dependencies
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const querystring = require('querystring');
const KMeans = require('kmeans-js');

// Spotify API credentials - these would come from environment variables in production
const SPOTIFY_CLIENT_ID = '45f9eb3e0ea045bfa30faeba6c3533df';
const SPOTIFY_CLIENT_SECRET = '0e80d7e1963e435fa49af94645748b8c';
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'user-read-private user-read-email user-top-read user-read-recently-played playlist-modify-public';
const STATE_KEY = 'spotify_auth_state';

// Initialize Express app
const app = express();
const PORT = 3000;

// Configure session middleware
app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: true
}));

// Set up template engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Generate random string for state verification
const generateRandomString = length => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Token refresh function
async function refreshAccessToken(refresh_token) {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      }), {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
}

// Get valid token function
async function getValidToken(req) {
  if (!req.session.access_token) {
    return null;
  }
  
  try {
    // Test if token is still valid
    await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + req.session.access_token }
    });
    return req.session.access_token;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Token expired, refresh it
      const newToken = await refreshAccessToken(req.session.refresh_token);
      req.session.access_token = newToken;
      return newToken;
    }
    throw error;
  }
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user || null });
});

// Login with Spotify
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  req.session[STATE_KEY] = state;

  const authURL = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state: state
    });

  console.log('Redirecting to Spotify auth page');
  res.redirect(authURL);
});

// Spotify callback with improved error handling
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.session[STATE_KEY] || null;
  const error = req.query.error || null;

  if (error) {
    console.error('Error returned from Spotify:', error);
    return res.redirect('/#error=' + error);
  }

  if (state === null || state !== storedState) {
    console.error('State mismatch error. Received:', state, 'Stored:', storedState);
    return res.redirect('/#error=state_mismatch');
  }

  try {
    console.log('Exchanging authorization code for token...');
    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }), {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

    console.log('Token obtained successfully');
    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    
    // Get user profile
    console.log('Fetching user profile...');
    const userProfileResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    
    // Store user data in session
    req.session.user = userProfileResponse.data;
    req.session.access_token = accessToken;
    req.session.refresh_token = refreshToken;
    
    console.log('Authentication successful, redirecting to dashboard');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during authentication:');
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error message:', error.message);
    }
    res.redirect('/#error=authentication_failed');
  }
});

// Dashboard - Main application after authentication
app.get('/dashboard', async (req, res) => {
  if (!req.session.user || !req.session.access_token) {
    console.log('No user session or access token found, redirecting to home');
    res.redirect('/');
    return;
  }

  try {
    // Get valid token
    const token = await getValidToken(req);
    if (!token) {
      console.log('Could not obtain valid token, redirecting to home');
      res.redirect('/');
      return;
    }
    
    console.log('Fetching top tracks...');
    // Get user's top tracks
    const topTracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks?limit=50', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    console.log('Fetching recently played tracks...');
    // Get user's recently played tracks
    const recentlyPlayedResponse = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    console.log('Generating recommendations...');
    // Process the data for recommendation
    const recommendations = await generateRecommendations(
      token,
      topTracksResponse.data.items,
      recentlyPlayedResponse.data.items
    );
    
    res.render('dashboard', { 
      user: req.session.user,
      topTracks: topTracksResponse.data.items,
      recommendations: recommendations
    });
  } catch (error) {
    console.error('Error fetching user data:');
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error message:', error.message);
    }
    res.redirect('/#error=data_fetch_failed');
  }
});

// Test auth route for debugging
app.get('/test-auth', (req, res) => {
  const state = generateRandomString(16);
  req.session[STATE_KEY] = state;
  
  const authURL = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: 'user-read-private user-read-email',
      redirect_uri: REDIRECT_URI,
      state: state
    });
  
  console.log('Test Auth URL:', authURL);
  res.send(`
    <h1>Testing Spotify Auth</h1>
    <p>Click the link below to test authentication:</p>
    <a href="${authURL}">Authenticate with Spotify</a>
    <p>Client ID: ${SPOTIFY_CLIENT_ID.substring(0, 4)}...${SPOTIFY_CLIENT_ID.substring(SPOTIFY_CLIENT_ID.length - 4)}</p>
    <p>Redirect URI: ${REDIRECT_URI}</p>
  `);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Rotating recommendation system for Spotify
async function generateRecommendations(accessToken, topTracks, recentlyPlayed) {
  try {
    console.log(`Processing tracks for recommendations...`);
    
    // Try different approaches based on session counter
    // We'll use a timestamp-based approach to rotate through different sources
    const timestamp = new Date().getTime();
    const rotationIndex = Math.floor(timestamp / 1000) % 3; // Changes every ~3 seconds
    
    console.log(`Using rotation index ${rotationIndex} for variety`);
    
    // Approach 1: Top Charts (New Releases with offset)
    if (rotationIndex === 0) {
      const offset = Math.floor(Math.random() * 20); // Random offset between 0-19
      console.log(`Getting new releases with offset ${offset}...`);
      
      const newReleasesResponse = await axios.get('https://api.spotify.com/v1/browse/new-releases', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        params: { 
          limit: 10,
          offset: offset // This provides variety
        }
      });
      
      if (newReleasesResponse.data?.albums?.items?.length > 0) {
        console.log(`Found ${newReleasesResponse.data.albums.items.length} new releases`);
        return formatAlbumsAsTracks(newReleasesResponse.data.albums.items);
      }
    }
    
    // Approach 2: Featured Playlists (with random selection)
    else if (rotationIndex === 1) {
      console.log('Getting tracks from featured playlists...');
      
      const featuredResponse = await axios.get('https://api.spotify.com/v1/browse/featured-playlists', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        params: { limit: 5 } // Get multiple playlists
      });
      
      if (featuredResponse.data?.playlists?.items?.length > 0) {
        // Pick a random playlist from the featured ones
        const randomIndex = Math.floor(Math.random() * featuredResponse.data.playlists.items.length);
        const playlist = featuredResponse.data.playlists.items[randomIndex];
        
        console.log(`Selected random playlist: ${playlist.name}`);
        
        const tracksResponse = await axios.get(playlist.tracks.href, {
          headers: { 'Authorization': 'Bearer ' + accessToken },
          params: { limit: 10 }
        });
        
        if (tracksResponse.data?.items?.length > 0) {
          return tracksResponse.data.items
            .filter(item => item.track) // Ensure track exists
            .map(item => item.track);
        }
      }
    }
    
    // Approach 3: Categories and Genre Playlists
    else {
      console.log('Getting tracks from category playlists...');
      
      // Get available categories
      const categoriesResponse = await axios.get('https://api.spotify.com/v1/browse/categories', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        params: { limit: 50 }
      });
      
      if (categoriesResponse.data?.categories?.items?.length > 0) {
        // Pick a random category
        const categories = categoriesResponse.data.categories.items;
        const randomCategoryIndex = Math.floor(Math.random() * categories.length);
        const category = categories[randomCategoryIndex];
        
        console.log(`Selected random category: ${category.name}`);
        
        // Get playlists for this category
        const categoryPlaylistsResponse = await axios.get(
          `https://api.spotify.com/v1/browse/categories/${category.id}/playlists`, {
            headers: { 'Authorization': 'Bearer ' + accessToken },
            params: { limit: 10 }
          }
        );
        
        if (categoryPlaylistsResponse.data?.playlists?.items?.length > 0) {
          // Pick a random playlist
          const playlists = categoryPlaylistsResponse.data.playlists.items;
          const randomPlaylistIndex = Math.floor(Math.random() * playlists.length);
          const playlist = playlists[randomPlaylistIndex];
          
          console.log(`Selected random playlist: ${playlist.name}`);
          
          // Get tracks from this playlist
          const tracksResponse = await axios.get(playlist.tracks.href, {
            headers: { 'Authorization': 'Bearer ' + accessToken },
            params: { limit: 10 }
          });
          
          if (tracksResponse.data?.items?.length > 0) {
            return tracksResponse.data.items
              .filter(item => item.track)
              .map(item => item.track);
          }
        }
      }
    }
    
    // Universal fallback - if the selected approach failed, try new releases
    console.log('Using universal fallback: varied new releases');
    const offset = Math.floor(Math.random() * 30); // Random offset between 0-29
    
    const newReleasesResponse = await axios.get('https://api.spotify.com/v1/browse/new-releases', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      params: { 
        limit: 10,
        offset: offset
      }
    });
    
    if (newReleasesResponse.data?.albums?.items?.length > 0) {
      return formatAlbumsAsTracks(newReleasesResponse.data.albums.items);
    }
    
    // Final fallback
    return [];
    
  } catch (error) {
    console.error('Error in recommendation system:', error.message);
    
    // Try one last fallback with random offset
    try {
      const offset = Math.floor(Math.random() * 40); // Even more variety in error cases
      
      const newReleasesResponse = await axios.get('https://api.spotify.com/v1/browse/new-releases', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        params: { 
          limit: 10,
          offset: offset
        }
      });
      
      if (newReleasesResponse.data?.albums?.items?.length > 0) {
        return formatAlbumsAsTracks(newReleasesResponse.data.albums.items);
      }
    } catch (finalError) {
      console.error('Final fallback failed:', finalError.message);
    }
    
    return [];
  }
}

// Helper function to format albums as tracks
function formatAlbumsAsTracks(albums) {
  console.log(`Formatting ${albums.length} albums as tracks`);
  return albums.map(album => ({
    id: album.id,
    name: album.name,
    artists: album.artists,
    album: album,
    uri: album.uri,
    external_urls: album.external_urls,
    type: 'album' // Mark as album
  }));
}
// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test authentication at http://localhost:${PORT}/test-auth`);
});