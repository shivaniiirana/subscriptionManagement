import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CardForm from './CardForm';

const stripePromise = loadStripe('pk_test_51RiXSnPYpcl2EDzo5IDBeTZ9RACo0wG9ZHLavZQAJS94SrYiiXK3VtDbV8iMl87MJUaGdCLhbzZeVdUSPEO5KRyG00tZQNa0ga');

function App() {
  return (
    <div>
      <h1>Subscribe</h1>
      <Elements stripe={stripePromise}>
        <CardForm 
          userId="USER_ID_FROM_DB" // Optional, if your backend needs it
        />
      </Elements>
    </div>
  );
}

export default App;