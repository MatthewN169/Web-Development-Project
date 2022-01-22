Comp 2406 Assignment 4
Matthew Nguyen
101145844
December 9, 2021

To run:
1. Unzip and change directory to assignment 4 folder
2. Type "npm install"
3. Type "mkdir database"
4. Open one terminal and type "mongod --dbpath database"
5. Open another terminal in a4 directory and type "node database-initializer.js"
6. Run with "npm start"
7. Go to http://localhost:3000/

Some Code decisions:
- Used if statements on pug to display certain things when conditions are met like logged in or not
- Passed in session data to pug file by creating middleware function to expose the session so the pug files can access if the
user is logged in or not and session object
- When registering, after inserting the user into the database, I called the login function which sends
the 201 success code and the id of the new user created and then redirected them in client side.
- When saving privacy I store the session id of the user on the user's pug page and then make an AJAX PUT request
using the id of the user
- When searching for users on the /users page you can type in the search bar provided or you
can type in the address bar /users?name=
- Saving the order, saves the order into the users database, I pass in the user's id and username
so when grabbing the orders from the database I just find the orders that have the same id as the user's
- I set the maxAge for the session to 30 minutes