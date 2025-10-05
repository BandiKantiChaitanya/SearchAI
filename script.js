const topics = ['Job Referral','Design Logo','Portfolio Review','LinkedIn Optimization','Website Hosting','Learn New Words','Profile Creation','Mock Interviews','Resume Building','Freelance Work','Startup Ideas','Career Advice','Personal Branding','Remote Jobs','Coding Help','Public Speaking Tips','Time Management','Interview Questions','Build a Website','Social Media Strategy','UI/UX Feedback','Create a Newsletter','Build Side Projects','Learn a Framework']

const intro = document.getElementById('intro-section');
const topicsContainer = document.getElementById('topics-container');
const promptContainer = document.getElementById('prompt-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const inputWrapper=document.getElementById('input-wrapper')


topics.forEach(topic => {
  const btn = document.createElement('button');
  btn.className = 'topic-btn';
  btn.textContent = topic;
  btn.onclick = () => handleSubmit(topic);
  topicsContainer.appendChild(btn);
});

promptContainer.classList.add('hidden');



// Add prompt on submit
function handleSubmit(value) {
  const input = value || searchInput.value.trim();
  if (!input) return;

  


  if (!promptContainer.classList.contains('visible')) {
    intro.classList.add('hidden');
    topicsContainer.classList.add('hidden');
    promptContainer.classList.remove('hidden');
    promptContainer.classList.add('visible');
    inputWrapper.classList.add('shift-up');
  }

  const msgWrapper = document.createElement('div');
  msgWrapper.className = 'message-wrapper user';

  const msg = document.createElement('div');
  msg.className = 'prompt-message';
  msg.textContent = input;

  msgWrapper.appendChild(msg)
  promptContainer.appendChild(msgWrapper);

  promptContainer.scrollTop = promptContainer.scrollHeight;

  

  searchInput.value = '';

  
  fetch('https://fakestoreapi.com/products?limit=10')
  .then(res=>res.json())
  .then(products=>{
    const resWrapper=document.createElement('div')
    const response=document.createElement('div')
    
    response.className='prompt-response'
    response.innerHTML+=`<p>The responses of the products are</p>`
    products.forEach(product => (
      response.innerHTML+=`
    <p>${product.title}</p>
    `
    ));

      resWrapper.className='message-wrapper response'
      resWrapper.appendChild(response)
      promptContainer.appendChild(resWrapper)
  }
  )
  .catch(err=>console.log('Error Occured',err))

  

}

searchBtn.onclick = () => handleSubmit();
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSubmit();
});