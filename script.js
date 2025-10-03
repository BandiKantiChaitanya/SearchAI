const topics = ['Job Referral','Design Logo','Portfolio Review','LinkedIn Optimization','Website Hosting','Learn New Words','Profile Creation','Mock Interviews','Resume Building','Freelance Work','Startup Ideas','Career Advice','Personal Branding','Remote Jobs','Coding Help','Public Speaking Tips','Time Management','Interview Questions','Build a Website','Social Media Strategy','UI/UX Feedback','Create a Newsletter','Build Side Projects','Learn a Framework']



const container = document.querySelector('.topics-container');


topics.forEach(topic => {
  const btn = document.createElement('button');
  btn.className = 'topic-btn';
  btn.textContent = topic;
  btn.onclick = () => handleSubmit(topic); 
  container.appendChild(btn);
});


function handleSubmit(topic) {
  alert(`You clicked on: ${topic}`);
}
