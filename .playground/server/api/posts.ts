import { defineEventHandler } from 'h3'

const posts = [
  { title: `10 Tips for Writing Clean JavaScript Code`, slug: `10-tips-for-writing-clean-javascript-code` },
  { title: `How to Build a Responsive Website with Bootstrap 5`, slug: `how-to-build-a-responsive-website-with-bootstrap-5` },
  { title: `Introduction to Machine Learning with Python`, slug: `introduction-to-machine-learning-with-python` },
  // { title: `5 Essential Tools for Web Developers in 2023`, slug: `5-essential-tools-for-web-developers-in-2023` },
  // { title: `Creating Scalable Node.js Applications with Express`, slug: `creating-scalable-nodejs-applications-with-express` },
  // { title: `The Future of Artificial Intelligence: A Comprehensive Guide`, slug: `the-future-of-artificial-intelligence-a-comprehensive-guide` },
  // { title: `Debugging Tips and Tricks for JavaScript Developers`, slug: `debugging-tips-and-tricks-for-javascript-developers` },
  // { title: `Building Interactive Web Applications with React`, slug: `building-interactive-web-applications-with-react` },
  // { title: `Getting Started with Data Science: A Beginner's Guide`, slug: `getting-started-with-data-science-a-beginners-guide` },
  // { title: `The Power of CSS Grid: A Complete Tutorial`, slug: `the-power-of-css-grid-a-complete-tutorial` },
  // { title: `10 Must-Have JavaScript Libraries for Web Developers`, slug: `10-must-have-javascript-libraries-for-web-developers` },
  // { title: `Developing iOS Applications with Swift`, slug: `developing-ios-applications-with-swift` },
  // { title: `How to Build a RESTful API with Node.js and MongoDB`, slug: `how-to-build-a-restful-api-with-nodejs-and-mongodb` },
  // { title: `Mastering CSS Flexbox: A Complete Guide`, slug: `mastering-css-flexbox-a-complete-guide` },
  // { title: `Introduction to Deep Learning: A Comprehensive Overview`, slug: `introduction-to-deep-learning-a-comprehensive-overview` },
  // { title: `Building Real-Time Applications with Socket.io`, slug: `building-real-time-applications-with-socketio` },
  // { title: `The State of Web Development in 2023`, slug: `the-state-of-web-development-in-2023` },
  // { title: `Advanced JavaScript Techniques for Experienced Developers`, slug: `advanced-javascript-techniques-for-experienced-developers` },
  // { title: `Creating Dynamic User Interfaces with Vue.js`, slug: `creating-dynamic-user-interfaces-with-vuejs` },
  // { title: `Getting Started with TensorFlow: A Beginner's Guide`, slug: `getting-started-with-tensorflow-a-beginners-guide` },
  // { title: `How to Optimize Website Performance for Mobile Users`, slug: `how-to-optimize-website-performance-for-mobile-users` },
  // { title: `Building Powerful Web Applications with Angular`, slug: `building-powerful-web-applications-with-angular` },
  // { title: `The Future of Cybersecurity: Trends and Predictions`, slug: `the-future-of-cybersecurity-trends-and-predictions` },
  // { title: `10 Common Mistakes to Avoid in JavaScript Development`, slug: `10-common-mistakes-to-avoid-in-javascript-development` },
  // { title: `Designing Responsive Emails with HTML and CSS`, slug: `designing-responsive-emails-with-html-and-css` },
]

  export default defineEventHandler(async () => {
    // const mock = true;
    // const posts = mock ? dummyPosts : await getPosts();
    return posts;
  });
