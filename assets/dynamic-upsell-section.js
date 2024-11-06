let handlePath = window.location.pathname.split('/');
let currentProductHandle = handlePath[handlePath.length - 1];
const cartDrawer = document.querySelector('cart-drawer');

document.addEventListener("DOMContentLoaded", function() {
    dynamicUpsellInit();
});

// function for loading in all of the data required to build the upsell section 
function dynamicUpsellInit(){
    let recentlyViewedProducts = JSON.parse(localStorage.getItem("recentlyViewedProducts")) || [];


    // Remove any old copies of the current product handle
    recentlyViewedProducts = recentlyViewedProducts.filter(handle => handle !== currentProductHandle);

    // Add the current product handle at the beginning of the list
    recentlyViewedProducts.unshift(currentProductHandle);

    // Limit the list to a maximum of the section setting + 1 (to account for the current product exclusion)
    let productLimit = document.querySelector('[data-max-upsells]').getAttribute('data-max-upsells');
    if (productLimit > 0 && recentlyViewedProducts.length > productLimit) {
        recentlyViewedProducts = recentlyViewedProducts.slice(0, productLimit + 1);
        document.querySelector('.dynamic-upsells-section').classList.remove('hide');
    }

    // Set a variable for if the add to carts should be enabled
    let enableATC = document.querySelector('[data-show-buy-buttons]').getAttribute('data-show-buy-buttons');


    // Save the updated list back to local storage
    localStorage.setItem("recentlyViewedProducts", JSON.stringify(recentlyViewedProducts));
    buildUpsell(recentlyViewedProducts, enableATC);
}


// For each product in the list, add a product to the dom
function buildUpsell(productHandles, showAddToCart){
    for(product of productHandles){
        if(product != currentProductHandle){
            getProductDetailsByHandle(product, showAddToCart);
        } 
    }
}

//Given a product, add it to the section.
async function getProductDetailsByHandle(productHandle, showAddToCart) {
  const storefrontAccessToken = '030afbf0f3112ac1c7d7cde6b116752e';
  const shopDomain = 'it-rainycity-tech-test.myshopify.com';
  
  const query = `
    {
      productByHandle(handle: "${productHandle}") {
        title
        variants(first: 1) {
          edges {
            node {
              id
              title
              priceV2 {
                amount
                currencyCode
              }
              image {
                src
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(`https://${shopDomain}/api/2023-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
    },
    body: JSON.stringify({ query })
  });

  const result = await response.json();
  const product = result.data.productByHandle;

  if (product) {
    const variant = product.variants.edges[0].node;
    let buyButton = '';

    if(showAddToCart){
        buyButton = `<button id="add-to-cart" data-product-id="${variant.id}">Add</button>`
    }

    const productHTML = `
      <div class="product">
        <a href='/products/${productHandle}'>
            <h2>${product.title}</h2>

            <img src="${variant.image.src}" alt="${variant.title}" height="100" width="100" />
        </a>
        <p>£${variant.priceV2.amount}</p>

        ${buyButton}
      </div>
    `;

    document.querySelector(".dynamic-upsells-container").innerHTML += productHTML;


    document.querySelectorAll('#add-to-cart').forEach(function(button) {
        button.addEventListener("click", function() {
            addToCart(extractNumericId(this.getAttribute('data-product-id')), 1);
        });
    });

  } else {
    console.log("Product not found");
  }
}


// Function to add the product to the cart
  function addToCart(variant_id) {
  let cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer'),
  formData = {
    items: [
      {
        id: variant_id,
        quantity: 1
      }
    ],
    sections: cart.getSectionsToRender().map(section => section.id)
  };
  cart.setActiveElement(document.activeElement);
  const config = fetchConfig('json');
  config.headers['X-Requested-With'] = 'XMLHttpRequest',
  config.body = JSON.stringify(formData),
  fetch(`${ routes.cart_add_url }`, config).then(response => response.json()).then(
    response => {
      if (response.errors) {
        publish(
          PUB_SUB_EVENTS.cartError,
          {
            source: 'product-form',
            productVariantId: variant_id,
            errors: response.errors,
            message: response.errors
          }
        );
        let errorMessageWrapper = document.querySelector('.product-form__error-message-wrapper');
        if (!errorMessageWrapper) return;
        let errorMessage = errorMessageWrapper.querySelector('.product-form__error-message');
        errorMessageWrapper.toggleAttribute('hidden', !errorMessage),
        errorMessage &&
        (errorMessage.textContent = response.errors)
      } else {
        publish(
          PUB_SUB_EVENTS.cartUpdate,
          {
            source: 'product-form',
            productVariantId: variant_id
          }
        );
        let cartObj = {};
        Object.assign(cartObj, response.items[0]),
        Object.assign(cartObj, {
          sections: response.sections
        }),
        cart.renderContents(cartObj),
        cart.classList.remove('is-empty'),
        trapFocus(
          document.getElementById('CartDrawer'),
          document.getElementById('CartDrawer')
        )
      }
    }
  )
}

// Function to extract the numeric ID from the GID string
function extractNumericId(gid) {
  const match = gid.match(/ProductVariant\/(\d+)/);
  return match ? match[1] : null;
}

