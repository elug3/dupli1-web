import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type LanguageCode = "en" | "ko" | "zh";

type TranslationValues = Record<string, string | number>;

interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  htmlLang: string;
  locale: string;
}

interface LanguageContextValue {
  language: LanguageCode;
  languageOption: LanguageOption;
  languages: LanguageOption[];
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, values?: TranslationValues) => string;
  formatCurrency: (amount: number) => string;
  translateProductName: (id: string, fallback: string) => string;
  translateProductDescription: (id: string, fallback: string) => string;
  translateValue: (scope: string, fallback: string) => string;
}

const STORAGE_KEY = "dupli1_language";

export const LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    htmlLang: "en",
    locale: "en-US",
  },
  {
    code: "ko",
    label: "Korean",
    nativeLabel: "한국어",
    htmlLang: "ko",
    locale: "ko-KR",
  },
  {
    code: "zh",
    label: "Chinese",
    nativeLabel: "中文",
    htmlLang: "zh-CN",
    locale: "zh-CN",
  },
];

const dictionaries: Record<LanguageCode, Record<string, string>> = {
  en: {
    "language.label": "Language",
    "language.english": "English",
    "language.korean": "Korean",
    "language.chinese": "Chinese",

    "announcement.freeShipping": "Free shipping on orders over $100",
    "announcement.code": "Code",
    "announcement.discount": "30% off",
    "announcement.copyCode": "Copy promo code SUMMER30",
    "announcement.copied": "Copied!",

    "contact.us": "Contact Us",
    "contact.telegram": "Contact Us on Telegram",
    "contact.kakao": "Contact Us on KakaoTalk",

    "cookie.title": "Cookies",
    "cookie.description":
      "We use cookies to keep your session secure, remember your preferences, and improve your shopping experience. By continuing, you agree to our use of cookies as described in our Privacy Policy.",
    "cookie.accept": "Accept",
    "cookie.decline": "Decline",

    "nav.home": "Home",
    "nav.bag": "Bag",
    "nav.profile": "Profile",
    "nav.productType": "Product Type",
    "nav.brand": "Brand",
    "nav.style": "Style",
    "nav.family": "Family",
    "nav.shoppingBag": "Shopping bag",
    "nav.search": "Search",
    "nav.history": "History",
    "nav.main": "Main",
    "nav.primary": "Primary",
    "nav.openMenu": "Open menu",
    "nav.closeMenu": "Close menu",

    "category.totes": "Totes",
    "category.shoulderBags": "Shoulder Bags",
    "category.crossbody": "Crossbody",
    "category.clutches": "Clutches",
    "category.miniBags": "Mini Bags",
    "category.backpacks": "Backpacks",
    "category.wallets": "Wallets",
    "category.casual": "Casual",
    "category.evening": "Evening",
    "category.business": "Business",
    "category.weekend": "Weekend",
    "category.statement": "Statement",
    "category.women": "Women",
    "category.men": "Men",
    "category.kids": "Kids",
    "category.unisex": "Unisex",
    "category.bags": "Bags",

    "footer.description":
      "Authentic luxury bags from the world's most coveted brands, curated for the modern wardrobe.",
    "footer.shop": "Shop",
    "footer.services": "Services",
    "footer.info": "Info",
    "footer.styleConsultation": "Style Consultation",
    "footer.orderHistory": "Order History",
    "footer.myAccount": "My Account",
    "footer.shippingReturns": "Shipping & Returns",
    "footer.authenticityGuarantee": "Quality Guarantee",
    "footer.privacyPolicy": "Privacy Policy",
    "footer.termsConditions": "Terms & Conditions",
    "footer.rights": "© 2026 Dupli1. All rights reserved.",
    "footer.tagline": "Premium Bags · Authenticated · Curated",

    "home.metaTitle": "Dupli1 — Curated Luxury Bags",
    "home.metaDescription":
      "Authentic luxury bags from the world's most coveted brands.",
    "home.eyebrow": "New Season 2026",
    "home.heroTitleLine1": "Carry",
    "home.heroTitleLine2": "the Icon.",
    "home.heroDescription":
      "Uncompromising materials. Meticulous craftsmanship. Authentic luxury bags from the world's most coveted brands.",
    "home.shopNow": "Shop Now",
    "home.styleConsult": "Style Consult",
    "home.heroAlt": "Luxury bag hero",
    "home.heroBadge": "New Season — Curated Luxury",
    "home.heroFeatured": "Editor's Pick",
    "home.heroViewProduct": "View Piece",
    "home.shopByBrand": "Shop by Brand",
    "home.viewAll": "View All",
    "home.featuredBags": "Featured Bags",
    "home.seeAll": "See All",
    "home.failedToLoadBags": "Failed to load bags",
    "home.lowStock": "Low Stock",
    "home.limitedTime": "Limited Time",
    "home.summerEdit": "Summer Edit",
    "home.saleDescription": "30% off selected bags",
    "home.shopSale": "Shop Sale",
    "home.summerEditAlt": "Summer Edit",
    "home.categoryEyebrow": "Curated Categories",
    "home.categoryTitle": "A sharper luxury edit.",
    "home.categoryDescription":
      "Explore an original selection inspired by category-led Korean luxury boutiques: handbags, sneakers, watches, and padded outerwear.",
    "home.shopCollection": "Shop Collection",
    "home.categoryBags": "Women’s Handbags",
    "home.categoryBagsDescription":
      "Structured icons, soft carryalls, and daily statement pieces.",
    "home.categorySneakers": "Men’s / Women’s Sneakers",
    "home.categorySneakersDescription":
      "Polished trainers with elevated materials and street-ready lines.",
    "home.categoryWatches": "Men’s / Women’s Watches",
    "home.categoryWatchesDescription":
      "Dress and sport profiles selected for everyday precision.",
    "home.categoryOuterwear": "Men’s / Women’s Padding",
    "home.categoryOuterwearDescription":
      "Technical padded layers with a clean city silhouette.",
    "home.crossCategoryEyebrow": "New Catalogue",
    "home.crossCategoryTitle": "Products across every edit",
    "home.crossCategoryDescription":
      "A broader assortment beyond bags, built with original product copy and category imagery.",
    "home.categoryLabel.bags": "Handbags",
    "home.categoryLabel.sneakers": "Sneakers",
    "home.categoryLabel.watches": "Watches",
    "home.categoryLabel.outerwear": "Padding",
    "home.valueFreeShipping": "Complimentary Shipping",
    "home.valueAuthenticity": "Authenticity Guaranteed",
    "home.valueCuration": "Expert Curation",
    "home.scroll": "Scroll",
    "home.editorialEyebrow": "The Dupli1 Edit",
    "home.editorialTitle": "Luxury, distilled.",
    "home.editorialBody":
      "Every piece passes our editors' lens — verified authenticity, impeccable condition, and a point of view that cuts through the noise.",
    "home.editorialCta": "Explore the Collection",
    "home.styleEyebrow": "Shop by Style",
    "home.styleTitle": "Dress the moment",
    "home.styleDescription":
      "From understated weekday carry to evening statements — find the silhouette that fits your rhythm.",
    "home.categoryExplore": "Explore",
    "home.featuredEyebrow": "The Selection",
    "home.brandMarquee": "Curated Houses",

    "product.metaTitle": "Product | Dupli1",
    "product.metaDescription": "Authentic luxury bag.",
    "product.signInRequired": "Sign In Required",
    "product.signInRequiredDescription":
      "Please sign in to view product details.",
    "product.signIn": "Sign In",
    "product.noProduct": "No product",
    "product.notFound": "Product not found",
    "product.notFoundDescription":
      "We could not find this product. It may have sold out, moved, or no longer be available.",
    "product.browseAllBags": "Browse all bags",
    "product.home": "Home",
    "product.bags": "Bags",
    "product.inStock": "In Stock",
    "product.outOfStock": "Out of Stock",
    "product.brand": "Brand",
    "product.category": "Category",
    "product.material": "Material",
    "product.color": "Color",
    "product.premiumLeather": "Premium Leather",
    "product.added": "Added",
    "product.addingToBag": "Adding…",
    "product.addToBag": "Add to Bag",
    "product.buy": "Buy",
    "product.contactUsTelegram": "Contact Us on Telegram",
    "product.bookStyleConsult": "Book Style Consult",
    "product.removeWishlist": "Remove from wishlist",
    "product.addWishlist": "Add to wishlist",
    "product.authenticity": "Quality",
    "product.guaranteed": "Guarantee",
    "product.qualityAssurance": "Quality Guarantee",
    "product.freeShipping": "Free Shipping",
    "product.over100": "Over $100",
    "product.easyReturns": "Easy Returns",
    "product.days30": "30 Days",
    "product.productDetails": "Product Details",
    "product.productDetailsBody":
      "Crafted with the finest materials and meticulous attention to detail. Each piece is individually inspected to ensure the highest quality standards.",
    "product.shippingReturns": "Shipping & Returns",
    "product.shippingReturnsBody":
      "Free standard shipping on orders over $100. Express and overnight options available at checkout. Returns accepted within 30 days of delivery.",
    "product.authenticityBody":
      "Every item sold by Dupli1 is backed by our Quality Guarantee. We partner directly with authorized retailers to ensure each product meets our rigorous standards.",
    "product.badgeNew": "New",
    "product.badgeFeatured": "Featured",
    "product.priceLoading": "Loading",

    "cart.metaTitle": "Shopping Bag — Dupli1",
    "cart.metaDescription":
      "Review your selected luxury bags and proceed to checkout.",
    "cart.continueShopping": "Continue Shopping",
    "cart.shoppingBag": "Shopping Bag",
    "cart.item": "item",
    "cart.items": "items",
    "cart.bagItems": "Bag items",
    "cart.size": "Size {size}",
    "cart.each": "{price} each",
    "cart.remove": "Remove",
    "cart.updating": "Updating…",
    "cart.removing": "Removing…",
    "cart.proceedToCheckout": "Proceed to Checkout",
    "cart.completeTheLook": "Complete the Look",
    "cart.pairsWellWith": "Pairs Well With",
    "cart.mostViewed": "Most Viewed",
    "cart.empty": "Your bag is empty.",
    "cart.emptyDescription":
      "Discover our curated selection of authenticated luxury bags from the world's most coveted maisons.",
    "cart.shopBags": "Shop Bags",
    "cart.orderSummary": "Order Summary",
    "cart.subtotal": "Subtotal",
    "cart.promo": "Promo ({code})",
    "cart.shipping": "Shipping",
    "cart.total": "Total",
    "cart.complimentary": "Complimentary",
    "cart.freeShippingProgress":
      "Add {amount} more for complimentary shipping.",
    "cart.promoCode": "Promo Code",
    "cart.apply": "Apply",
    "cart.invalidPromo": "Invalid promo code",
    "cart.discountApplied": "{discount}% off applied.",
    "cart.authenticityGuaranteed": "Quality guarantee on every order",
    "cart.complimentaryShippingOver":
      "Complimentary shipping over {amount}",
    "cart.returns": "30-day returns on eligible items",
    "cart.decreaseQuantity": "Decrease quantity",
    "cart.increaseQuantity": "Increase quantity",
    "cart.needAssistance": "Need assistance?",
    "cart.assistanceDescription":
      "Contact the Dupli1 Client Services team for personal shopping support.",

    "checkout.metaTitle": "Checkout — Dupli1",
    "checkout.metaDescription":
      "Complete your Dupli1 order with secure checkout.",
    "checkout.invalidPromo": "Invalid promo code",
    "checkout.required": "Required",
    "checkout.validEmail": "Enter a valid email",
    "checkout.nothingToCheckout": "Nothing to checkout",
    "checkout.emptyBag": "Your bag is empty. Add items before proceeding.",
    "checkout.backToBag": "Back to Bag",
    "checkout.secureCheckout": "Secure Checkout",
    "checkout.completeOrder": "Complete Your Order",
    "checkout.contact": "Contact",
    "checkout.email": "Email",
    "checkout.phone": "Phone",
    "checkout.shipping": "Shipping",
    "checkout.firstName": "First Name",
    "checkout.lastName": "Last Name",
    "checkout.address": "Address",
    "checkout.apartment": "Apartment, suite, etc. (optional)",
    "checkout.city": "City",
    "checkout.state": "State",
    "checkout.zip": "ZIP Code",
    "checkout.country": "Country",
    "checkout.countryValue": "Republic of Korea",
    "checkout.delivery": "Delivery",
    "checkout.standardDelivery": "Standard Delivery",
    "checkout.standardDeliveryTime": "5–7 business days",
    "checkout.expressDelivery": "Express Delivery",
    "checkout.expressDeliveryTime": "2–3 business days",
    "checkout.payment": "Payment",
    "checkout.cardName": "Name on Card",
    "checkout.cardNumber": "Card Number",
    "checkout.expiry": "Expiry",
    "checkout.cvc": "CVC",
    "checkout.paymentNote":
      "Your payment details are encrypted. This is a demo checkout — no charges will be made.",
    "checkout.processing": "Processing…",
    "checkout.placeOrder": "Place Order",
    "checkout.placeOrderWithTotal": "Place Order — {total}",
    "checkout.yourBag": "Your Bag ({count})",
    "checkout.stepInformation": "Contact & Shipping",
    "checkout.stepDelivery": "Delivery",
    "checkout.stepPayment": "Payment",
    "checkout.stepCount": "Step {current} of {total}",
    "checkout.continueToDelivery": "Continue to Delivery",
    "checkout.continueToPayment": "Continue to Payment",
    "checkout.previousStep": "Previous Step",

    "confirmation.metaTitle": "Order Confirmed — Dupli1",
    "confirmation.metaDescription":
      "Your Dupli1 order has been placed successfully.",
    "confirmation.orderConfirmed": "Order Confirmed",
    "confirmation.thankYou": "Thank You",
    "confirmation.emailTo": "A confirmation email will be sent to {email}.",
    "confirmation.emailShortly": "A confirmation email will be sent shortly.",
    "confirmation.order": "Order",
    "confirmation.total": "Total",
    "confirmation.viewOrders": "View Orders",

    "login.metaTitle": "Sign in | Dupli1",
    "login.metaDescription": "Sign in to your Dupli1 account.",
    "login.welcomeBack": "Welcome back",
    "login.createYourAccount": "Create your account",
    "login.email": "Email",
    "login.password": "Password",
    "login.somethingWentWrong": "Something went wrong",
    "login.pleaseWait": "Please wait…",
    "login.signIn": "Sign in",
    "login.createAccount": "Create account",
    "login.noAccount": "Don't have an account?",
    "login.hasAccount": "Already have an account?",
    "login.signUp": "Sign up",
    "signup.stepTerms": "Terms",
    "signup.stepSecurity": "Security",
    "signup.stepProfile": "Profile",
    "signup.stepOneEyebrow": "Step 01",
    "signup.stepTwoEyebrow": "Step 02",
    "signup.stepThreeEyebrow": "Step 03",
    "signup.termsTitle": "Review membership terms",
    "signup.termsDescription":
      "Confirm the license terms before creating your Dupli1 account.",
    "signup.licenseIntro":
      "By joining Dupli1, you agree to use the service for personal shopping, account management, and order support.",
    "signup.licenseTermOne":
      "You will provide accurate account information and keep it up to date.",
    "signup.licenseTermTwo":
      "You accept Dupli1's terms for product browsing, checkout, and account services.",
    "signup.licenseTermThree":
      "You understand that marketing messages are optional and can be changed later.",
    "signup.agreeTerms": "I agree to the license terms and privacy policy.",
    "signup.securityTitle": "Create a secure password",
    "signup.securityDescription":
      "Use a strong password and confirm it before continuing.",
    "signup.password": "Password",
    "signup.passwordAgain": "Password again",
    "signup.passwordSafety": "Password safety",
    "signup.passwordWeak": "Weak",
    "signup.passwordGood": "Good",
    "signup.passwordStrong": "Strong",
    "signup.passwordRuleLength": "At least 8 characters",
    "signup.passwordRuleCase": "Uppercase and lowercase letters",
    "signup.passwordRuleNumber": "At least one number",
    "signup.passwordRuleSymbol": "At least one symbol",
    "signup.passwordsMatch": "Passwords match.",
    "signup.passwordsDoNotMatch": "Passwords do not match.",
    "signup.profileTitle": "Complete your profile",
    "signup.profileDescription":
      "Add your name and choose whether to receive curated product updates.",
    "signup.name": "Name",
    "signup.namePlaceholder": "Your name",
    "signup.marketingConsent": "I agree to receive marketing updates.",
    "signup.marketingConsentDescription":
      "Get product drops, private edits, and promotion news. You can opt out anytime.",
    "signup.continue": "Continue",
    "signup.finishSignup": "Create account",
    "signup.backToSignIn": "Back to sign in",
    "signup.errorTerms": "Please agree to the license terms to continue.",
    "signup.errorPasswordWeak": "Please choose a safer password.",
    "signup.errorPasswordMatch": "Please make sure both passwords match.",
    "signup.errorName": "Please enter your name.",
    "signup.welcomeEyebrow": "Welcome",
    "signup.welcomeTitle": "Welcome, {name}",
    "signup.welcomeDescription":
      "Your Dupli1 account is ready. You can now manage your profile, wishlist, coupons, and orders.",
    "signup.goToAccount": "Go to account",

    "profile.metaTitle": "Account | Dupli1",
    "profile.metaDescription": "Manage your Dupli1 account.",
    "profile.signInToDupli1": "Sign in to Dupli1",
    "profile.signInDescription":
      "Access your wishlist, orders, and personal settings.",
    "profile.signIn": "Sign in",
    "profile.account": "Account",
    "profile.signOut": "Sign out",
    "profile.wishlist": "Wishlist",
    "profile.coupons": "Coupons",
    "profile.orders": "Orders",
    "profile.accountSettings": "Account Settings",
    "profile.support": "Support",
    "profile.emptyWishlist": "Your wishlist is empty.",
    "profile.removeWishlist": "Remove from wishlist",
    "profile.active": "{count} active",
    "profile.redeemCode": "Redeem a code",
    "profile.redeem": "Redeem",
    "profile.couponAdded": "Coupon added successfully.",
    "profile.couponAlready": "This coupon is already in your account.",
    "profile.invalidCoupon": "Invalid coupon code. Please check and try again.",
    "profile.noActiveCoupons": "No active coupons.",
    "profile.usedExpired": "Used & Expired",
    "profile.expired": "Expired",
    "profile.used": "Used",
    "profile.expires": "Expires",
    "profile.copied": "Copied!",
    "profile.copy": "Copy",
    "profile.noOrders": "You haven't placed any orders yet.",
    "profile.profile": "Profile",
    "profile.firstName": "First name",
    "profile.lastName": "Last name",
    "profile.email": "Email",
    "profile.phone": "Phone",
    "profile.saved": "Saved!",
    "profile.saveChanges": "Save changes",
    "profile.password": "Password",
    "profile.currentPassword": "Current password",
    "profile.newPassword": "New password",
    "profile.confirmPassword": "Confirm new password",
    "profile.updatePassword": "Update password",
    "profile.emailNotifications": "Email Notifications",
    "profile.orderUpdates": "Order updates & shipping",
    "profile.promotions": "Promotions & offers",
    "profile.wishlistDrops": "Wishlist price drops",
    "profile.newArrivals": "New arrivals",
    "profile.dangerZone": "Danger Zone",
    "profile.deleteAccount": "Delete account",
    "profile.faq": "Frequently Asked Questions",
    "profile.contactUs": "Contact Us",
    "profile.subject": "Subject",
    "profile.orderId": "Order ID (optional)",
    "profile.message": "Message",
    "profile.messagePlaceholder": "Describe your issue…",
    "profile.messageSent": "Message sent!",
    "profile.sendMessage": "Send message",
    "profile.faqTrackOrder": "How do I track my order?",
    "profile.faqTrackOrderAnswer":
      "Once your order ships, you'll receive an email with a tracking link. You can also view tracking in the Orders section.",
    "profile.faqReturnPolicy": "What is your return policy?",
    "profile.faqReturnPolicyAnswer":
      "We accept returns within 14 days of delivery. Items must be unused and in original packaging. Contact support to initiate a return.",
    "profile.faqAuthenticated": "Are all items authenticated?",
    "profile.faqAuthenticatedAnswer":
      "Yes. Every item on Dupli1 undergoes our rigorous 12-point authentication process before listing.",
    "profile.faqApplyCoupon": "How do I apply a coupon?",
    "profile.faqApplyCouponAnswer":
      "Enter your coupon code at checkout in the promo code field. Only one code may be applied per order.",
    "profile.faqCancelOrder": "Can I cancel or modify an order?",
    "profile.faqCancelOrderAnswer":
      "Orders can be cancelled within 1 hour of placement. After that, please contact our support team and we'll do our best to assist.",

    "notFound.metaTitle": "Page not found | Dupli1",
    "notFound.metaDescription": "The requested Dupli1 page could not be found.",
    "notFound.title": "Page not found",
    "notFound.description":
      "The page you are looking for does not exist or has been moved.",
    "category.empty": "No products match this category yet. Browse the full collection instead.",

    "history.metaTitle": "History | Dupli1",
    "history.metaDescription": "View recent browsing history.",
    "history.title": "History",
    "history.eyebrow": "Your activity",
    "history.description":
      "Pick up where you left off with recently viewed bags and past searches.",
    "history.recentlyViewed": "Recently viewed",
    "history.recentSearches": "Recent searches",
    "history.emptyViews": "You have not viewed any products yet.",
    "history.emptySearches": "Your search history is empty.",
    "history.clear": "Clear",
    "history.bags": "Bags",
    "history.justNow": "Just now",
    "history.minutesAgo": "{count}m ago",
    "history.hoursAgo": "{count}h ago",
    "history.daysAgo": "{count}d ago",

    "search.placeholder": "Search bags, brands, styles…",
    "search.hint": "Type to search the collection",
    "search.searching": "Searching…",
    "search.noResults": "No bags match your search.",
    "search.viewAll": "View all results",
    "search.close": "Close search",
    "search.recentHistory": "Recent history",
    "search.resultsFor": "Results for “{query}”",

    "admin.newProduct": "New product",
    "admin.newProductDescription": "Add a product to the catalogue.",
    "admin.accessDenied": "Access denied",
    "admin.accessDeniedDescription":
      "Only admins and product managers can add new products.",
    "admin.goHome": "Go home",
    "admin.productAdded": "Product added!",
    "admin.productAddedDescription":
      "The product has been successfully registered.",
    "admin.addAnother": "Add another",
    "admin.viewProducts": "View products",
    "admin.category": "Category",
    "admin.saveProduct": "Save product",
    "admin.uploadingImage": "Uploading image…",
    "admin.saving": "Saving…",
    "admin.selectCategory": "Select a category above to continue.",
    "admin.productImage": "Product image",
    "admin.preview": "Preview",
    "admin.imageHint": "Click or drag an image here",
    "admin.select": "Select…",
    "admin.category.consultations": "Consultations",
    "admin.category.shoes": "Shoes",
    "admin.category.outerwear": "Outerwear",
    "admin.category.bottoms": "Bottoms",
    "admin.category.bags": "Bags",
    "admin.category.clocks": "Watches",

    "field.name": "Name",
    "field.productName": "Product name",
    "field.brandName": "Brand name",
    "field.price": "Price ($)",
    "field.stock": "Stock",
    "field.description": "Description",
    "field.productDescription": "Product description…",
    "field.color": "Color",
    "field.material": "Material",
    "field.title": "Title",
    "field.consultationName": "Consultation name",
    "field.consultationDescription": "Describe the consultation…",
    "field.status": "Status",
    "field.duration": "Duration (min)",
    "field.size": "Size",
    "field.gender": "Gender",
    "field.capacity": "Capacity",
    "field.type": "Type",

    "value.available": "available",
    "value.unavailable": "unavailable",
    "value.male": "Male",
    "value.female": "Female",
    "value.unisex": "Unisex",
    "value.analog": "Analog",
    "value.digital": "Digital",
    "value.smart": "Smart",
  },
  ko: {
    "language.label": "언어",
    "language.english": "영어",
    "language.korean": "한국어",
    "language.chinese": "중국어",

    "announcement.freeShipping": "$100 이상 주문 시 무료 배송",
    "announcement.code": "코드",
    "announcement.discount": "30% 할인",
    "announcement.copyCode": "프로모션 코드 SUMMER30 복사",
    "announcement.copied": "복사됨!",

    "contact.us": "문의하기",
    "contact.telegram": "텔레그램 문의하기",
    "contact.kakao": "카카오톡 문의하기",

    "cookie.title": "쿠키",
    "cookie.description":
      "세션 보안 유지, 환경 설정 저장, 쇼핑 경험 개선을 위해 쿠키를 사용합니다. 계속 이용하시면 개인정보 처리방침에 설명된 쿠키 사용에 동의하는 것으로 간주됩니다.",
    "cookie.accept": "동의",
    "cookie.decline": "거부",

    "nav.home": "홈",
    "nav.bag": "장바구니",
    "nav.profile": "프로필",
    "nav.productType": "카테고리",
    "nav.brand": "브랜드",
    "nav.style": "스타일",
    "nav.family": "대상",
    "nav.shoppingBag": "장바구니",
    "nav.search": "검색",
    "nav.history": "내역",
    "nav.main": "메인",
    "nav.primary": "주요 메뉴",
    "nav.openMenu": "메뉴 열기",
    "nav.closeMenu": "메뉴 닫기",

    "category.totes": "토트백",
    "category.shoulderBags": "숄더백",
    "category.crossbody": "크로스백",
    "category.clutches": "클러치",
    "category.miniBags": "미니백",
    "category.backpacks": "백팩",
    "category.wallets": "지갑",
    "category.casual": "캐주얼",
    "category.evening": "이브닝",
    "category.business": "비즈니스",
    "category.weekend": "주말",
    "category.statement": "스테이트먼트",
    "category.women": "여성",
    "category.men": "남성",
    "category.kids": "키즈",
    "category.unisex": "유니섹스",
    "category.bags": "가방",

    "footer.description":
      "세계적인 럭셔리 브랜드의 정품 가방을 현대적인 옷장에 맞게 엄선했습니다.",
    "footer.shop": "쇼핑",
    "footer.services": "서비스",
    "footer.info": "정보",
    "footer.styleConsultation": "스타일 상담",
    "footer.orderHistory": "주문 내역",
    "footer.myAccount": "내 계정",
    "footer.shippingReturns": "배송 및 반품",
    "footer.authenticityGuarantee": "품질 보증",
    "footer.privacyPolicy": "개인정보 처리방침",
    "footer.termsConditions": "이용 약관",
    "footer.rights": "© 2026 Dupli1. All rights reserved.",
    "footer.tagline": "프리미엄 가방 · 정품 보증 · 엄선 큐레이션",

    "home.metaTitle": "Dupli1 — 엄선한 럭셔리 가방",
    "home.metaDescription":
      "세계적으로 사랑받는 브랜드의 정품 럭셔리 가방.",
    "home.eyebrow": "2026 새 시즌",
    "home.heroTitleLine1": "아이콘을",
    "home.heroTitleLine2": "걸치다.",
    "home.heroDescription":
      "타협 없는 소재와 정교한 장인정신으로 완성한, 세계 명품 브랜드의 정품 럭셔리 가방.",
    "home.shopNow": "쇼핑하기",
    "home.styleConsult": "스타일 상담",
    "home.heroAlt": "럭셔리 가방 메인 이미지",
    "home.heroBadge": "새 시즌 — 엄선 럭셔리",
    "home.heroFeatured": "에디터 추천",
    "home.heroViewProduct": "상품 보기",
    "home.shopByBrand": "브랜드별 보기",
    "home.viewAll": "전체 보기",
    "home.featuredBags": "추천 가방",
    "home.seeAll": "전체 보기",
    "home.failedToLoadBags": "상품을 불러오지 못했습니다",
    "home.lowStock": "재고 소진 임박",
    "home.limitedTime": "기간 한정",
    "home.summerEdit": "서머 에디트",
    "home.saleDescription": "선정 상품 30% 할인",
    "home.shopSale": "세일 상품 보기",
    "home.summerEditAlt": "서머 에디트",
    "home.categoryEyebrow": "큐레이션 카테고리",
    "home.categoryTitle": "더 또렷한 럭셔리 큐레이션",
    "home.categoryDescription":
      "카테고리별로 엄선한 럭셔리 컬렉션. 핸드백, 스니커즈, 시계, 패딩 아우터를 만나보세요.",
    "home.shopCollection": "컬렉션 보기",
    "home.categoryBags": "여성 핸드백",
    "home.categoryBagsDescription":
      "구조감 있는 아이콘 백부터 부드러운 토트, 데일리 포인트 아이템까지.",
    "home.categorySneakers": "남성/여성 스니커즈",
    "home.categorySneakersDescription":
      "고급 소재와 세련된 실루엣의 스니커즈.",
    "home.categoryWatches": "남성/여성 시계",
    "home.categoryWatchesDescription":
      "일상에 어울리는 드레스·스포츠 시계.",
    "home.categoryOuterwear": "남성/여성 패딩",
    "home.categoryOuterwearDescription":
      "깔끔한 실루엣의 기능성 패딩 아우터.",
    "home.crossCategoryEyebrow": "신규 카탈로그",
    "home.crossCategoryTitle": "카테고리별 추천 상품",
    "home.crossCategoryDescription":
      "가방을 넘어 스니커즈, 시계, 아우터까지 폭넓게 준비했습니다.",
    "home.categoryLabel.bags": "핸드백",
    "home.categoryLabel.sneakers": "스니커즈",
    "home.categoryLabel.watches": "시계",
    "home.categoryLabel.outerwear": "패딩",
    "home.valueFreeShipping": "무료 배송",
    "home.valueAuthenticity": "정품 보증",
    "home.valueCuration": "전문 큐레이션",
    "home.scroll": "스크롤",
    "home.editorialEyebrow": "Dupli1 에디트",
    "home.editorialTitle": "럭셔리, 정제되다.",
    "home.editorialBody":
      "모든 피스는 에디터의 기준을 통과합니다. 정품 인증, 완벽한 컨디션, 그리고 확고한 큐레이션.",
    "home.editorialCta": "컬렉션 둘러보기",
    "home.styleEyebrow": "스타일별 쇼핑",
    "home.styleTitle": "순간에 맞는 실루엣",
    "home.styleDescription":
      "일상의 절제된 캐리부터 이브닝 스테이트먼트까지 — 당신의 리듬에 맞는 실루엣을 찾아보세요.",
    "home.categoryExplore": "둘러보기",
    "home.featuredEyebrow": "셀렉션",
    "home.brandMarquee": "큐레이션 하우스",

    "product.metaTitle": "제품 | Dupli1",
    "product.metaDescription": "정품 럭셔리 가방.",
    "product.signInRequired": "로그인이 필요합니다",
    "product.signInRequiredDescription":
      "제품 상세 정보를 보려면 로그인해 주세요.",
    "product.signIn": "로그인",
    "product.noProduct": "제품 없음",
    "product.notFound": "제품을 찾을 수 없습니다",
    "product.notFoundDescription":
      "이 제품을 찾을 수 없습니다. 품절되었거나 이동되었거나 더 이상 제공되지 않을 수 있습니다.",
    "product.browseAllBags": "전체 가방 보기",
    "product.home": "홈",
    "product.bags": "가방",
    "product.inStock": "재고 있음",
    "product.outOfStock": "품절",
    "product.brand": "브랜드",
    "product.category": "카테고리",
    "product.material": "소재",
    "product.color": "색상",
    "product.premiumLeather": "프리미엄 가죽",
    "product.added": "추가됨",
    "product.addingToBag": "담는 중…",
    "product.addToBag": "장바구니에 담기",
    "product.buy": "구매하기",
    "product.contactUsTelegram": "텔레그램 문의하기",
    "product.bookStyleConsult": "스타일 상담 예약",
    "product.removeWishlist": "위시리스트에서 제거",
    "product.addWishlist": "위시리스트에 추가",
    "product.authenticity": "품질",
    "product.guaranteed": "보증",
    "product.qualityAssurance": "품질 보증",
    "product.freeShipping": "무료 배송",
    "product.over100": "$100 이상",
    "product.easyReturns": "간편 반품",
    "product.days30": "30일",
    "product.productDetails": "제품 상세",
    "product.productDetailsBody":
      "최고급 소재와 세심한 디테일로 제작되었습니다. 각 제품은 높은 품질 기준을 위해 개별 검수됩니다.",
    "product.shippingReturns": "배송 및 반품",
    "product.shippingReturnsBody":
      "$100 이상 주문 시 무료 일반 배송. 결제 시 특급 및 익일 배송 옵션을 선택할 수 있습니다. 배송 후 30일 이내 반품 가능합니다.",
    "product.authenticityBody":
      "Dupli1에서 판매되는 모든 상품은 품질 보증이 적용됩니다. 공식 리테일러와 직접 협력하여 엄격한 품질 기준을 충족하는 제품만 제공합니다.",
    "product.badgeNew": "신상품",
    "product.badgeFeatured": "추천",
    "product.priceLoading": "불러오는 중",

    "cart.metaTitle": "장바구니 — Dupli1",
    "cart.metaDescription":
      "담은 상품을 확인하고 결제를 진행하세요.",
    "cart.continueShopping": "쇼핑 계속하기",
    "cart.shoppingBag": "장바구니",
    "cart.item": "개",
    "cart.items": "개",
    "cart.bagItems": "담은 상품",
    "cart.size": "사이즈 {size}",
    "cart.each": "개당 {price}",
    "cart.remove": "삭제",
    "cart.updating": "변경 중…",
    "cart.removing": "삭제 중…",
    "cart.proceedToCheckout": "결제로 이동",
    "cart.completeTheLook": "스타일링 완성하기",
    "cart.pairsWellWith": "함께 코디하기 좋은 상품",
    "cart.mostViewed": "인기 상품",
    "cart.empty": "장바구니가 비어 있습니다.",
    "cart.emptyDescription":
      "세계 명품 브랜드의 정품 럭셔리 가방을 만나보세요.",
    "cart.shopBags": "가방 둘러보기",
    "cart.orderSummary": "주문 요약",
    "cart.subtotal": "소계",
    "cart.promo": "프로모션 ({code})",
    "cart.shipping": "배송",
    "cart.total": "합계",
    "cart.complimentary": "무료",
    "cart.freeShippingProgress": "무료 배송까지 {amount} 더 담으세요.",
    "cart.promoCode": "프로모션 코드",
    "cart.apply": "적용",
    "cart.invalidPromo": "유효하지 않은 프로모션 코드",
    "cart.discountApplied": "{discount}% 할인이 적용되었습니다.",
    "cart.authenticityGuaranteed": "모든 주문 품질 보증",
    "cart.complimentaryShippingOver": "{amount} 이상 무료 배송",
    "cart.returns": "대상 상품 30일 반품",
    "cart.decreaseQuantity": "수량 줄이기",
    "cart.increaseQuantity": "수량 늘리기",
    "cart.needAssistance": "도움이 필요하신가요?",
    "cart.assistanceDescription":
      "퍼스널 쇼핑 상담은 Dupli1 고객센터로 문의해 주세요.",

    "checkout.metaTitle": "결제 — Dupli1",
    "checkout.metaDescription": "안전한 결제로 Dupli1 주문을 완료하세요.",
    "checkout.invalidPromo": "유효하지 않은 프로모션 코드",
    "checkout.required": "필수 항목",
    "checkout.validEmail": "유효한 이메일을 입력하세요",
    "checkout.nothingToCheckout": "결제할 상품이 없습니다",
    "checkout.emptyBag": "장바구니가 비어 있습니다. 상품을 먼저 담아 주세요.",
    "checkout.backToBag": "장바구니로 돌아가기",
    "checkout.secureCheckout": "안전 결제",
    "checkout.completeOrder": "주문하기",
    "checkout.contact": "연락처",
    "checkout.email": "이메일",
    "checkout.phone": "전화번호",
    "checkout.shipping": "배송",
    "checkout.firstName": "이름",
    "checkout.lastName": "성",
    "checkout.address": "주소",
    "checkout.apartment": "상세 주소 (선택)",
    "checkout.city": "도시",
    "checkout.state": "주/도",
    "checkout.zip": "우편번호",
    "checkout.country": "국가",
    "checkout.countryValue": "대한민국",
    "checkout.delivery": "배송 방법",
    "checkout.standardDelivery": "일반 배송",
    "checkout.standardDeliveryTime": "영업일 기준 5–7일",
    "checkout.expressDelivery": "특급 배송",
    "checkout.expressDeliveryTime": "영업일 기준 2–3일",
    "checkout.payment": "결제",
    "checkout.cardName": "카드 명의",
    "checkout.cardNumber": "카드 번호",
    "checkout.expiry": "만료일",
    "checkout.cvc": "CVC",
    "checkout.paymentNote":
      "결제 정보는 암호화됩니다. 이 화면은 데모 결제이며 실제 청구는 발생하지 않습니다.",
    "checkout.processing": "처리 중…",
    "checkout.placeOrder": "주문하기",
    "checkout.placeOrderWithTotal": "주문하기 — {total}",
    "checkout.yourBag": "장바구니 ({count})",
    "checkout.stepInformation": "연락처 및 배송지",
    "checkout.stepDelivery": "배송 방법",
    "checkout.stepPayment": "결제",
    "checkout.stepCount": "총 {total}단계 중 {current}단계",
    "checkout.continueToDelivery": "배송 방법 선택",
    "checkout.continueToPayment": "결제 정보 입력",
    "checkout.previousStep": "이전 단계",

    "confirmation.metaTitle": "주문 확인 — Dupli1",
    "confirmation.metaDescription": "Dupli1 주문이 성공적으로 접수되었습니다.",
    "confirmation.orderConfirmed": "주문 확인",
    "confirmation.thankYou": "감사합니다",
    "confirmation.emailTo": "확인 이메일을 {email}(으)로 보내드립니다.",
    "confirmation.emailShortly": "확인 이메일을 곧 보내드립니다.",
    "confirmation.order": "주문",
    "confirmation.total": "합계",
    "confirmation.viewOrders": "주문 보기",

    "login.metaTitle": "로그인 | Dupli1",
    "login.metaDescription": "Dupli1 계정에 로그인하세요.",
    "login.welcomeBack": "다시 오신 것을 환영합니다",
    "login.createYourAccount": "계정 만들기",
    "login.email": "이메일",
    "login.password": "비밀번호",
    "login.somethingWentWrong": "문제가 발생했습니다",
    "login.pleaseWait": "잠시만 기다려 주세요…",
    "login.signIn": "로그인",
    "login.createAccount": "계정 만들기",
    "login.noAccount": "계정이 없으신가요?",
    "login.hasAccount": "이미 계정이 있으신가요?",
    "login.signUp": "가입하기",
    "signup.stepTerms": "약관",
    "signup.stepSecurity": "보안",
    "signup.stepProfile": "프로필",
    "signup.stepOneEyebrow": "1단계",
    "signup.stepTwoEyebrow": "2단계",
    "signup.stepThreeEyebrow": "3단계",
    "signup.termsTitle": "회원 약관 확인",
    "signup.termsDescription":
      "Dupli1 계정을 만들기 전에 이용약관을 확인해 주세요.",
    "signup.licenseIntro":
      "Dupli1 회원으로 가입하면 쇼핑, 계정 관리, 주문 관련 서비스 이용에 동의하게 됩니다.",
    "signup.licenseTermOne":
      "본인의 정확한 정보를 제공하고, 변경 시 즉시 업데이트합니다.",
    "signup.licenseTermTwo":
      "상품 조회, 결제, 계정 서비스 이용에 관한 Dupli1 이용약관에 동의합니다.",
    "signup.licenseTermThree":
      "마케팅 수신은 선택 사항이며, 언제든지 변경할 수 있습니다.",
    "signup.agreeTerms": "이용약관 및 개인정보 처리방침에 동의합니다.",
    "signup.securityTitle": "안전한 비밀번호 만들기",
    "signup.securityDescription":
      "강력한 비밀번호를 입력하고 한 번 더 확인해 주세요.",
    "signup.password": "비밀번호",
    "signup.passwordAgain": "비밀번호 확인",
    "signup.passwordSafety": "비밀번호 안전도",
    "signup.passwordWeak": "약함",
    "signup.passwordGood": "보통",
    "signup.passwordStrong": "강함",
    "signup.passwordRuleLength": "8자 이상",
    "signup.passwordRuleCase": "대문자와 소문자 포함",
    "signup.passwordRuleNumber": "숫자 1개 이상",
    "signup.passwordRuleSymbol": "기호 1개 이상",
    "signup.passwordsMatch": "비밀번호가 일치합니다.",
    "signup.passwordsDoNotMatch": "비밀번호가 일치하지 않습니다.",
    "signup.profileTitle": "프로필 완성",
    "signup.profileDescription":
      "이름을 입력하고 마케팅 수신 여부를 선택해 주세요.",
    "signup.name": "이름",
    "signup.namePlaceholder": "이름",
    "signup.marketingConsent": "마케팅 정보 수신에 동의합니다.",
    "signup.marketingConsentDescription":
      "신상품, 큐레이션 소식, 프로모션 안내를 받아보실 수 있습니다. 언제든지 수신을 거부할 수 있습니다.",
    "signup.continue": "계속",
    "signup.finishSignup": "계정 만들기",
    "signup.backToSignIn": "로그인으로 돌아가기",
    "signup.errorTerms": "계속하려면 이용약관에 동의해 주세요.",
    "signup.errorPasswordWeak": "더 안전한 비밀번호를 선택해 주세요.",
    "signup.errorPasswordMatch": "두 비밀번호가 일치하는지 확인해 주세요.",
    "signup.errorName": "이름을 입력해 주세요.",
    "signup.welcomeEyebrow": "환영합니다",
    "signup.welcomeTitle": "{name}님, 환영합니다",
    "signup.welcomeDescription":
      "Dupli1 계정이 준비되었습니다. 프로필, 위시리스트, 쿠폰, 주문 내역을 관리할 수 있습니다.",
    "signup.goToAccount": "계정으로 이동",

    "profile.metaTitle": "계정 | Dupli1",
    "profile.metaDescription": "Dupli1 계정을 관리하세요.",
    "profile.signInToDupli1": "Dupli1에 로그인",
    "profile.signInDescription":
      "위시리스트, 주문 내역, 계정 설정을 이용하세요.",
    "profile.signIn": "로그인",
    "profile.account": "계정",
    "profile.signOut": "로그아웃",
    "profile.wishlist": "위시리스트",
    "profile.coupons": "쿠폰",
    "profile.orders": "주문",
    "profile.accountSettings": "계정 설정",
    "profile.support": "지원",
    "profile.emptyWishlist": "위시리스트가 비어 있습니다.",
    "profile.removeWishlist": "위시리스트에서 제거",
    "profile.active": "활성 {count}개",
    "profile.redeemCode": "코드 등록",
    "profile.redeem": "등록",
    "profile.couponAdded": "쿠폰이 추가되었습니다.",
    "profile.couponAlready": "이미 계정에 있는 쿠폰입니다.",
    "profile.invalidCoupon": "유효하지 않은 쿠폰 코드입니다. 다시 확인해 주세요.",
    "profile.noActiveCoupons": "활성 쿠폰이 없습니다.",
    "profile.usedExpired": "사용·만료",
    "profile.expired": "만료됨",
    "profile.used": "사용됨",
    "profile.expires": "만료일",
    "profile.copied": "복사됨!",
    "profile.copy": "복사",
    "profile.noOrders": "아직 주문이 없습니다.",
    "profile.profile": "프로필",
    "profile.firstName": "이름",
    "profile.lastName": "성",
    "profile.email": "이메일",
    "profile.phone": "전화번호",
    "profile.saved": "저장됨!",
    "profile.saveChanges": "변경 사항 저장",
    "profile.password": "비밀번호",
    "profile.currentPassword": "현재 비밀번호",
    "profile.newPassword": "새 비밀번호",
    "profile.confirmPassword": "새 비밀번호 확인",
    "profile.updatePassword": "비밀번호 변경",
    "profile.emailNotifications": "이메일 알림",
    "profile.orderUpdates": "주문 및 배송 업데이트",
    "profile.promotions": "프로모션 및 혜택",
    "profile.wishlistDrops": "위시리스트 할인 알림",
    "profile.newArrivals": "신상품",
    "profile.dangerZone": "주의",
    "profile.deleteAccount": "계정 삭제",
    "profile.faq": "자주 묻는 질문",
    "profile.contactUs": "문의하기",
    "profile.subject": "제목",
    "profile.orderId": "주문 ID (선택)",
    "profile.message": "메시지",
    "profile.messagePlaceholder": "문제를 설명해 주세요…",
    "profile.messageSent": "메시지가 전송되었습니다!",
    "profile.sendMessage": "메시지 보내기",
    "profile.faqTrackOrder": "주문은 어떻게 추적하나요?",
    "profile.faqTrackOrderAnswer":
      "주문이 발송되면 추적 링크가 포함된 이메일을 받게 됩니다. 주문 섹션에서도 추적 정보를 확인할 수 있습니다.",
    "profile.faqReturnPolicy": "반품 정책은 무엇인가요?",
    "profile.faqReturnPolicyAnswer":
      "배송 완료 후 14일 이내 반품이 가능합니다. 상품은 미사용 상태이며 원래 포장을 유지해야 합니다. 반품은 고객센터로 문의해 주세요.",
    "profile.faqAuthenticated": "모든 상품이 정품 인증되나요?",
    "profile.faqAuthenticatedAnswer":
      "네. Dupli1의 모든 상품은 등록 전 엄격한 12단계 인증 과정을 거칩니다.",
    "profile.faqApplyCoupon": "쿠폰은 어떻게 적용하나요?",
    "profile.faqApplyCouponAnswer":
      "결제 화면의 프로모션 코드 입력란에 쿠폰 코드를 입력하세요. 주문당 하나의 코드만 적용할 수 있습니다.",
    "profile.faqCancelOrder": "주문을 취소하거나 변경할 수 있나요?",
    "profile.faqCancelOrderAnswer":
      "주문 후 1시간 이내에는 취소할 수 있습니다. 이후에는 지원팀에 문의해 주시면 가능한 한 도와드리겠습니다.",

    "notFound.metaTitle": "페이지를 찾을 수 없음 | Dupli1",
    "notFound.metaDescription": "요청한 Dupli1 페이지를 찾을 수 없습니다.",
    "notFound.title": "페이지를 찾을 수 없습니다",
    "notFound.description":
      "찾고 있는 페이지가 존재하지 않거나 이동되었습니다.",
    "category.empty": "이 카테고리에 해당하는 상품이 없습니다. 전체 컬렉션을 둘러보세요.",

    "history.metaTitle": "내역 | Dupli1",
    "history.metaDescription": "최근 탐색 내역을 확인하세요.",
    "history.title": "내역",
    "history.eyebrow": "활동 내역",
    "history.description":
      "최근 본 상품과 검색 기록으로 쇼핑을 이어가세요.",
    "history.recentlyViewed": "최근 본 상품",
    "history.recentSearches": "최근 검색",
    "history.emptyViews": "아직 본 상품이 없습니다.",
    "history.emptySearches": "검색 기록이 없습니다.",
    "history.clear": "지우기",
    "history.bags": "가방",
    "history.justNow": "방금",
    "history.minutesAgo": "{count}분 전",
    "history.hoursAgo": "{count}시간 전",
    "history.daysAgo": "{count}일 전",

    "search.placeholder": "가방, 브랜드, 스타일 검색…",
    "search.hint": "컬렉션을 검색하려면 입력하세요",
    "search.searching": "검색 중…",
    "search.noResults": "검색 결과가 없습니다.",
    "search.viewAll": "전체 결과 보기",
    "search.close": "검색 닫기",
    "search.recentHistory": "최근 내역",
    "search.resultsFor": "“{query}” 검색 결과",

    "admin.newProduct": "새 제품",
    "admin.newProductDescription": "카탈로그에 제품을 추가하세요.",
    "admin.accessDenied": "접근 권한 없음",
    "admin.accessDeniedDescription":
      "관리자와 제품 매니저만 새 제품을 추가할 수 있습니다.",
    "admin.goHome": "홈으로",
    "admin.productAdded": "제품이 추가되었습니다!",
    "admin.productAddedDescription": "제품이 성공적으로 등록되었습니다.",
    "admin.addAnother": "하나 더 추가",
    "admin.viewProducts": "제품 보기",
    "admin.category": "카테고리",
    "admin.saveProduct": "제품 저장",
    "admin.uploadingImage": "이미지 업로드 중…",
    "admin.saving": "저장 중…",
    "admin.selectCategory": "계속하려면 위에서 카테고리를 선택하세요.",
    "admin.productImage": "제품 이미지",
    "admin.preview": "미리보기",
    "admin.imageHint": "클릭하거나 이미지를 여기로 드래그하세요",
    "admin.select": "선택…",
    "admin.category.consultations": "상담",
    "admin.category.shoes": "신발",
    "admin.category.outerwear": "아우터",
    "admin.category.bottoms": "하의",
    "admin.category.bags": "가방",
    "admin.category.clocks": "시계",

    "field.name": "이름",
    "field.productName": "제품명",
    "field.brandName": "브랜드명",
    "field.price": "가격 ($)",
    "field.stock": "재고",
    "field.description": "설명",
    "field.productDescription": "제품 설명…",
    "field.color": "색상",
    "field.material": "소재",
    "field.title": "제목",
    "field.consultationName": "상담 이름",
    "field.consultationDescription": "상담 내용을 설명하세요…",
    "field.status": "상태",
    "field.duration": "소요 시간 (분)",
    "field.size": "사이즈",
    "field.gender": "성별",
    "field.capacity": "용량",
    "field.type": "유형",

    "value.available": "이용 가능",
    "value.unavailable": "이용 불가",
    "value.male": "남성",
    "value.female": "여성",
    "value.unisex": "유니섹스",
    "value.analog": "아날로그",
    "value.digital": "디지털",
    "value.smart": "스마트",
  },
  zh: {
    "language.label": "语言",
    "language.english": "英语",
    "language.korean": "韩语",
    "language.chinese": "中文",

    "announcement.freeShipping": "订单满 $100 免运费",
    "announcement.code": "代码",
    "announcement.discount": "7 折优惠",
    "announcement.copyCode": "复制优惠码 SUMMER30",
    "announcement.copied": "已复制",

    "contact.us": "联系我们",
    "contact.telegram": "Telegram 联系我们",
    "contact.kakao": "KakaoTalk 联系我们",

    "cookie.title": "Cookie",
    "cookie.description":
      "我们使用 Cookie 保障会话安全、记住您的偏好并改善购物体验。继续浏览即表示您同意我们按照隐私政策所述使用 Cookie。",
    "cookie.accept": "接受",
    "cookie.decline": "拒绝",

    "nav.home": "首页",
    "nav.bag": "购物袋",
    "nav.profile": "个人资料",
    "nav.productType": "产品类型",
    "nav.brand": "品牌",
    "nav.style": "风格",
    "nav.family": "人群",
    "nav.shoppingBag": "购物袋",
    "nav.search": "搜索",
    "nav.history": "历史",
    "nav.main": "主导航",
    "nav.primary": "主要导航",
    "nav.openMenu": "打开菜单",
    "nav.closeMenu": "关闭菜单",

    "category.totes": "托特包",
    "category.shoulderBags": "单肩包",
    "category.crossbody": "斜挎包",
    "category.clutches": "手拿包",
    "category.miniBags": "迷你包",
    "category.backpacks": "双肩包",
    "category.wallets": "钱包",
    "category.casual": "休闲",
    "category.evening": "晚宴",
    "category.business": "商务",
    "category.weekend": "周末",
    "category.statement": "个性",
    "category.women": "女士",
    "category.men": "男士",
    "category.kids": "儿童",
    "category.unisex": "中性",
    "category.bags": "包袋",

    "footer.description":
      "来自全球热门奢侈品牌的正品包袋，为现代衣橱精心甄选。",
    "footer.shop": "购物",
    "footer.services": "服务",
    "footer.info": "信息",
    "footer.styleConsultation": "造型咨询",
    "footer.orderHistory": "订单历史",
    "footer.myAccount": "我的账户",
    "footer.shippingReturns": "配送与退货",
    "footer.authenticityGuarantee": "品质保证",
    "footer.privacyPolicy": "隐私政策",
    "footer.termsConditions": "条款与条件",
    "footer.rights": "© 2026 Dupli1. 保留所有权利。",
    "footer.tagline": "高级包袋 · 正品认证 · 精选策划",

    "home.metaTitle": "Dupli1 — 精选奢华包袋",
    "home.metaDescription": "来自全球热门品牌的正品奢华包袋。",
    "home.eyebrow": "2026 新季",
    "home.heroTitleLine1": "携带",
    "home.heroTitleLine2": "经典。",
    "home.heroDescription":
      "严选材质，精湛工艺，呈现全球热门品牌的正品奢华包袋。",
    "home.shopNow": "立即选购",
    "home.styleConsult": "造型咨询",
    "home.heroAlt": "奢华包袋主视觉",
    "home.heroBadge": "新季 — 精选奢华",
    "home.heroFeatured": "编辑推荐",
    "home.heroViewProduct": "查看单品",
    "home.shopByBrand": "按品牌选购",
    "home.viewAll": "查看全部",
    "home.featuredBags": "精选包袋",
    "home.seeAll": "查看全部",
    "home.failedToLoadBags": "无法加载包袋",
    "home.lowStock": "库存不多",
    "home.limitedTime": "限时",
    "home.summerEdit": "夏日精选",
    "home.saleDescription": "指定包袋 7 折",
    "home.shopSale": "选购折扣",
    "home.summerEditAlt": "夏日精选",
    "home.categoryEyebrow": "精选分类",
    "home.categoryTitle": "更鲜明的奢华甄选。",
    "home.categoryDescription":
      "以韩国分类式奢华精品店为灵感，打造原创精选：手袋、运动鞋、腕表和羽绒外套。",
    "home.shopCollection": "选购系列",
    "home.categoryBags": "女士手袋",
    "home.categoryBagsDescription": "结构感经典、柔软托包和日常个性单品。",
    "home.categorySneakers": "男士/女士运动鞋",
    "home.categorySneakersDescription": "高级材质与街头线条兼具的精致训练鞋。",
    "home.categoryWatches": "男士/女士腕表",
    "home.categoryWatchesDescription": "为日常精准表现甄选的正装与运动表款。",
    "home.categoryOuterwear": "男士/女士羽绒",
    "home.categoryOuterwearDescription": "拥有干净都市廓形的技术感保暖外套。",
    "home.crossCategoryEyebrow": "新目录",
    "home.crossCategoryTitle": "覆盖每个精选主题的产品",
    "home.crossCategoryDescription":
      "以原创产品文案和分类图片扩展包袋之外的商品阵容。",
    "home.categoryLabel.bags": "手袋",
    "home.categoryLabel.sneakers": "运动鞋",
    "home.categoryLabel.watches": "腕表",
    "home.categoryLabel.outerwear": "羽绒",
    "home.valueFreeShipping": "免运费",
    "home.valueAuthenticity": "正品保证",
    "home.valueCuration": "专业甄选",
    "home.scroll": "滚动",
    "home.editorialEyebrow": "Dupli1 精选",
    "home.editorialTitle": "奢华，精炼呈现。",
    "home.editorialBody":
      "每一件单品都经过编辑甄选——正品认证、完美品相，以及独树一帜的审美视角。",
    "home.editorialCta": "探索系列",
    "home.styleEyebrow": "按风格选购",
    "home.styleTitle": "为时刻而选",
    "home.styleDescription":
      "从低调日常到晚宴焦点——找到契合你节奏的包型。",
    "home.categoryExplore": "探索",
    "home.featuredEyebrow": "精选系列",
    "home.brandMarquee": "甄选品牌",

    "product.metaTitle": "产品 | Dupli1",
    "product.metaDescription": "正品奢华包袋。",
    "product.signInRequired": "需要登录",
    "product.signInRequiredDescription": "请登录以查看产品详情。",
    "product.signIn": "登录",
    "product.noProduct": "没有产品",
    "product.notFound": "未找到产品",
    "product.notFoundDescription":
      "我们找不到该产品。它可能已售罄、已移动或不再提供。",
    "product.browseAllBags": "浏览所有包袋",
    "product.home": "首页",
    "product.bags": "包袋",
    "product.inStock": "有货",
    "product.outOfStock": "缺货",
    "product.brand": "品牌",
    "product.category": "分类",
    "product.material": "材质",
    "product.color": "颜色",
    "product.premiumLeather": "高级皮革",
    "product.added": "已添加",
    "product.addingToBag": "添加中…",
    "product.addToBag": "加入购物袋",
    "product.buy": "购买",
    "product.contactUsTelegram": "Telegram 联系我们",
    "product.bookStyleConsult": "预约造型咨询",
    "product.removeWishlist": "从愿望清单移除",
    "product.addWishlist": "加入愿望清单",
    "product.authenticity": "品质",
    "product.guaranteed": "保证",
    "product.qualityAssurance": "品质保证",
    "product.freeShipping": "免费配送",
    "product.over100": "满 $100",
    "product.easyReturns": "轻松退货",
    "product.days30": "30 天",
    "product.productDetails": "产品详情",
    "product.productDetailsBody":
      "采用上乘材质并注重每一处细节。每件商品都会单独检验，以确保最高品质标准。",
    "product.shippingReturns": "配送与退货",
    "product.shippingReturnsBody":
      "订单满 $100 享免费标准配送。结账时可选择加急和隔夜配送。收货后 30 天内可退货。",
    "product.authenticityBody":
      "Dupli1 售出的每件商品均享有品质保证。我们直接与授权零售商合作，确保每件商品均符合我们的严格品质标准。",
    "product.badgeNew": "新品",
    "product.badgeFeatured": "精选",
    "product.priceLoading": "加载中",

    "cart.metaTitle": "购物袋 — Dupli1",
    "cart.metaDescription": "查看已选奢华包袋并继续结账。",
    "cart.continueShopping": "继续购物",
    "cart.shoppingBag": "购物袋",
    "cart.item": "件商品",
    "cart.items": "件商品",
    "cart.bagItems": "购物袋商品",
    "cart.size": "尺码 {size}",
    "cart.each": "每件 {price}",
    "cart.remove": "移除",
    "cart.updating": "更新中…",
    "cart.removing": "移除中…",
    "cart.proceedToCheckout": "继续结账",
    "cart.completeTheLook": "完善造型",
    "cart.pairsWellWith": "搭配推荐",
    "cart.mostViewed": "最多浏览",
    "cart.empty": "购物袋为空。",
    "cart.emptyDescription": "探索我们精选的全球知名品牌正品奢华包袋。",
    "cart.shopBags": "选购包袋",
    "cart.orderSummary": "订单摘要",
    "cart.subtotal": "小计",
    "cart.promo": "优惠 ({code})",
    "cart.shipping": "配送",
    "cart.total": "合计",
    "cart.complimentary": "免费",
    "cart.freeShippingProgress": "再加 {amount} 即可享免费配送。",
    "cart.promoCode": "优惠码",
    "cart.apply": "应用",
    "cart.invalidPromo": "优惠码无效",
    "cart.discountApplied": "已应用 {discount}% 折扣。",
    "cart.authenticityGuaranteed": "每笔订单均提供品质保证",
    "cart.complimentaryShippingOver": "满 {amount} 免费配送",
    "cart.returns": "符合条件商品 30 天退货",
    "cart.decreaseQuantity": "减少数量",
    "cart.increaseQuantity": "增加数量",
    "cart.needAssistance": "需要帮助？",
    "cart.assistanceDescription": "联系 Dupli1 客户服务团队获取个人购物支持。",

    "checkout.metaTitle": "结账 — Dupli1",
    "checkout.metaDescription": "通过安全结账完成您的 Dupli1 订单。",
    "checkout.invalidPromo": "优惠码无效",
    "checkout.required": "必填",
    "checkout.validEmail": "请输入有效的电子邮箱",
    "checkout.nothingToCheckout": "没有可结账的商品",
    "checkout.emptyBag": "您的购物袋为空。请先添加商品。",
    "checkout.backToBag": "返回购物袋",
    "checkout.secureCheckout": "安全结账",
    "checkout.completeOrder": "完成订单",
    "checkout.contact": "联系信息",
    "checkout.email": "电子邮箱",
    "checkout.phone": "电话",
    "checkout.shipping": "配送",
    "checkout.firstName": "名",
    "checkout.lastName": "姓",
    "checkout.address": "地址",
    "checkout.apartment": "公寓、套房等（可选）",
    "checkout.city": "城市",
    "checkout.state": "州/省",
    "checkout.zip": "邮编",
    "checkout.country": "国家",
    "checkout.countryValue": "大韩民国",
    "checkout.delivery": "配送方式",
    "checkout.standardDelivery": "标准配送",
    "checkout.standardDeliveryTime": "5–7 个工作日",
    "checkout.expressDelivery": "加急配送",
    "checkout.expressDeliveryTime": "2–3 个工作日",
    "checkout.payment": "付款",
    "checkout.cardName": "持卡人姓名",
    "checkout.cardNumber": "卡号",
    "checkout.expiry": "有效期",
    "checkout.cvc": "CVC",
    "checkout.paymentNote":
      "您的付款信息已加密。这是演示结账，不会产生实际扣款。",
    "checkout.processing": "处理中…",
    "checkout.placeOrder": "提交订单",
    "checkout.placeOrderWithTotal": "提交订单 — {total}",
    "checkout.yourBag": "您的购物袋 ({count})",
    "checkout.stepInformation": "联系与配送地址",
    "checkout.stepDelivery": "配送方式",
    "checkout.stepPayment": "付款",
    "checkout.stepCount": "第 {current} 步，共 {total} 步",
    "checkout.continueToDelivery": "继续选择配送",
    "checkout.continueToPayment": "继续付款",
    "checkout.previousStep": "上一步",

    "confirmation.metaTitle": "订单已确认 — Dupli1",
    "confirmation.metaDescription": "您的 Dupli1 订单已成功提交。",
    "confirmation.orderConfirmed": "订单已确认",
    "confirmation.thankYou": "谢谢您",
    "confirmation.emailTo": "确认邮件将发送至 {email}。",
    "confirmation.emailShortly": "确认邮件将很快发送。",
    "confirmation.order": "订单",
    "confirmation.total": "合计",
    "confirmation.viewOrders": "查看订单",

    "login.metaTitle": "登录 | Dupli1",
    "login.metaDescription": "登录您的 Dupli1 账户。",
    "login.welcomeBack": "欢迎回来",
    "login.createYourAccount": "创建账户",
    "login.email": "电子邮箱",
    "login.password": "密码",
    "login.somethingWentWrong": "出现问题",
    "login.pleaseWait": "请稍候…",
    "login.signIn": "登录",
    "login.createAccount": "创建账户",
    "login.noAccount": "还没有账户？",
    "login.hasAccount": "已经有账户？",
    "login.signUp": "注册",
    "signup.stepTerms": "条款",
    "signup.stepSecurity": "安全",
    "signup.stepProfile": "资料",
    "signup.stepOneEyebrow": "步骤 01",
    "signup.stepTwoEyebrow": "步骤 02",
    "signup.stepThreeEyebrow": "步骤 03",
    "signup.termsTitle": "查看会员条款",
    "signup.termsDescription": "创建 Dupli1 账户前，请确认许可条款。",
    "signup.licenseIntro":
      "加入 Dupli1 即表示您同意将服务用于个人购物、账户管理和订单支持。",
    "signup.licenseTermOne": "您将提供准确的账户信息并保持更新。",
    "signup.licenseTermTwo":
      "您接受 Dupli1 关于商品浏览、结账和账户服务的条款。",
    "signup.licenseTermThree":
      "您了解营销信息为可选项，之后可随时更改。",
    "signup.agreeTerms": "我同意许可条款和隐私政策。",
    "signup.securityTitle": "创建安全密码",
    "signup.securityDescription": "使用强密码，并在继续前再次确认。",
    "signup.password": "密码",
    "signup.passwordAgain": "再次输入密码",
    "signup.passwordSafety": "密码安全性",
    "signup.passwordWeak": "弱",
    "signup.passwordGood": "良好",
    "signup.passwordStrong": "强",
    "signup.passwordRuleLength": "至少 8 个字符",
    "signup.passwordRuleCase": "包含大小写字母",
    "signup.passwordRuleNumber": "至少一个数字",
    "signup.passwordRuleSymbol": "至少一个符号",
    "signup.passwordsMatch": "密码一致。",
    "signup.passwordsDoNotMatch": "两次密码不一致。",
    "signup.profileTitle": "完善您的资料",
    "signup.profileDescription": "添加姓名，并选择是否接收精选商品更新。",
    "signup.name": "姓名",
    "signup.namePlaceholder": "您的姓名",
    "signup.marketingConsent": "我同意接收营销更新。",
    "signup.marketingConsentDescription":
      "接收新品上架、私人精选和促销消息。您可以随时取消订阅。",
    "signup.continue": "继续",
    "signup.finishSignup": "创建账户",
    "signup.backToSignIn": "返回登录",
    "signup.errorTerms": "请同意许可条款后继续。",
    "signup.errorPasswordWeak": "请选择更安全的密码。",
    "signup.errorPasswordMatch": "请确认两次密码一致。",
    "signup.errorName": "请输入您的姓名。",
    "signup.welcomeEyebrow": "欢迎",
    "signup.welcomeTitle": "欢迎，{name}",
    "signup.welcomeDescription":
      "您的 Dupli1 账户已准备就绪。现在可以管理个人资料、愿望清单、优惠券和订单。",
    "signup.goToAccount": "前往账户",

    "profile.metaTitle": "账户 | Dupli1",
    "profile.metaDescription": "管理您的 Dupli1 账户。",
    "profile.signInToDupli1": "登录 Dupli1",
    "profile.signInDescription": "访问您的愿望清单、订单和个人设置。",
    "profile.signIn": "登录",
    "profile.account": "账户",
    "profile.signOut": "退出登录",
    "profile.wishlist": "愿望清单",
    "profile.coupons": "优惠券",
    "profile.orders": "订单",
    "profile.accountSettings": "账户设置",
    "profile.support": "支持",
    "profile.emptyWishlist": "您的愿望清单为空。",
    "profile.removeWishlist": "从愿望清单移除",
    "profile.active": "{count} 张可用",
    "profile.redeemCode": "兑换代码",
    "profile.redeem": "兑换",
    "profile.couponAdded": "优惠券已成功添加。",
    "profile.couponAlready": "该优惠券已在您的账户中。",
    "profile.invalidCoupon": "优惠码无效。请检查后重试。",
    "profile.noActiveCoupons": "没有可用优惠券。",
    "profile.usedExpired": "已使用和已过期",
    "profile.expired": "已过期",
    "profile.used": "已使用",
    "profile.expires": "到期",
    "profile.copied": "已复制！",
    "profile.copy": "复制",
    "profile.noOrders": "您还没有下过订单。",
    "profile.profile": "个人资料",
    "profile.firstName": "名",
    "profile.lastName": "姓",
    "profile.email": "电子邮箱",
    "profile.phone": "电话",
    "profile.saved": "已保存！",
    "profile.saveChanges": "保存更改",
    "profile.password": "密码",
    "profile.currentPassword": "当前密码",
    "profile.newPassword": "新密码",
    "profile.confirmPassword": "确认新密码",
    "profile.updatePassword": "更新密码",
    "profile.emailNotifications": "电子邮件通知",
    "profile.orderUpdates": "订单和配送更新",
    "profile.promotions": "促销与优惠",
    "profile.wishlistDrops": "愿望清单降价",
    "profile.newArrivals": "新品上架",
    "profile.dangerZone": "危险区域",
    "profile.deleteAccount": "删除账户",
    "profile.faq": "常见问题",
    "profile.contactUs": "联系我们",
    "profile.subject": "主题",
    "profile.orderId": "订单 ID（可选）",
    "profile.message": "消息",
    "profile.messagePlaceholder": "描述您的问题…",
    "profile.messageSent": "消息已发送！",
    "profile.sendMessage": "发送消息",
    "profile.faqTrackOrder": "如何跟踪订单？",
    "profile.faqTrackOrderAnswer":
      "订单发货后，您会收到包含跟踪链接的邮件。您也可以在订单部分查看跟踪信息。",
    "profile.faqReturnPolicy": "你们的退货政策是什么？",
    "profile.faqReturnPolicyAnswer":
      "我们接受收货后 14 天内退货。商品必须未使用并保持原包装。请联系支持团队发起退货。",
    "profile.faqAuthenticated": "所有商品都经过认证吗？",
    "profile.faqAuthenticatedAnswer":
      "是的。Dupli1 上的每件商品在上架前都会经过严格的 12 点认证流程。",
    "profile.faqApplyCoupon": "如何使用优惠券？",
    "profile.faqApplyCouponAnswer":
      "在结账时的优惠码输入框中输入您的优惠券代码。每个订单只能使用一个代码。",
    "profile.faqCancelOrder": "可以取消或修改订单吗？",
    "profile.faqCancelOrderAnswer":
      "下单后 1 小时内可以取消。之后请联系我们的支持团队，我们会尽力协助。",

    "notFound.metaTitle": "页面未找到 | Dupli1",
    "notFound.metaDescription": "无法找到请求的 Dupli1 页面。",
    "notFound.title": "页面未找到",
    "notFound.description": "您查找的页面不存在或已被移动。",
    "category.empty": "此分类暂无商品，请浏览全部系列。",

    "history.metaTitle": "历史 | Dupli1",
    "history.metaDescription": "查看最近浏览历史。",
    "history.title": "历史",
    "history.eyebrow": "您的活动",
    "history.description": "通过最近浏览和搜索记录继续购物。",
    "history.recentlyViewed": "最近浏览",
    "history.recentSearches": "最近搜索",
    "history.emptyViews": "您还没有浏览过任何商品。",
    "history.emptySearches": "搜索记录为空。",
    "history.clear": "清除",
    "history.bags": "手袋",
    "history.justNow": "刚刚",
    "history.minutesAgo": "{count} 分钟前",
    "history.hoursAgo": "{count} 小时前",
    "history.daysAgo": "{count} 天前",

    "search.placeholder": "搜索手袋、品牌、风格…",
    "search.hint": "输入以搜索系列",
    "search.searching": "搜索中…",
    "search.noResults": "没有匹配的商品。",
    "search.viewAll": "查看全部结果",
    "search.close": "关闭搜索",
    "search.recentHistory": "最近历史",
    "search.resultsFor": "“{query}” 的搜索结果",

    "admin.newProduct": "新产品",
    "admin.newProductDescription": "向目录添加产品。",
    "admin.accessDenied": "访问被拒绝",
    "admin.accessDeniedDescription": "只有管理员和产品经理可以添加新产品。",
    "admin.goHome": "回到首页",
    "admin.productAdded": "产品已添加！",
    "admin.productAddedDescription": "产品已成功注册。",
    "admin.addAnother": "继续添加",
    "admin.viewProducts": "查看产品",
    "admin.category": "分类",
    "admin.saveProduct": "保存产品",
    "admin.uploadingImage": "正在上传图片…",
    "admin.saving": "正在保存…",
    "admin.selectCategory": "请选择上方分类以继续。",
    "admin.productImage": "产品图片",
    "admin.preview": "预览",
    "admin.imageHint": "点击或将图片拖到这里",
    "admin.select": "选择…",
    "admin.category.consultations": "咨询",
    "admin.category.shoes": "鞋履",
    "admin.category.outerwear": "外套",
    "admin.category.bottoms": "下装",
    "admin.category.bags": "包袋",
    "admin.category.clocks": "腕表",

    "field.name": "名称",
    "field.productName": "产品名称",
    "field.brandName": "品牌名称",
    "field.price": "价格 ($)",
    "field.stock": "库存",
    "field.description": "描述",
    "field.productDescription": "产品描述…",
    "field.color": "颜色",
    "field.material": "材质",
    "field.title": "标题",
    "field.consultationName": "咨询名称",
    "field.consultationDescription": "描述咨询内容…",
    "field.status": "状态",
    "field.duration": "时长（分钟）",
    "field.size": "尺码",
    "field.gender": "性别",
    "field.capacity": "容量",
    "field.type": "类型",

    "value.available": "可用",
    "value.unavailable": "不可用",
    "value.male": "男士",
    "value.female": "女士",
    "value.unisex": "中性",
    "value.analog": "模拟",
    "value.digital": "数字",
    "value.smart": "智能",
  },
};

const productTranslations: Record<
  string,
  Partial<Record<LanguageCode, { name?: string; description?: string }>>
> = {
  "bag-lv-express-mm": {
    ko: {
      name: "루이비통 익스프레스 MM",
      description: "루이비통 익스프레스 MM. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton Express MM",
      description: "Louis Vuitton Express MM，采用涂层帆布材质。",
    },
  },
  "bag-lv-speedy-bandouliere-20": {
    ko: {
      name: "루이비통 스피디 반둘리에20",
      description: "루이비통 스피디 반둘리에20. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton Speedy Bandoulière 20",
      description: "Louis Vuitton Speedy Bandoulière 20，采用涂层帆布材质。",
    },
  },
  "bag-lv-keepall-bandouliere-25": {
    ko: {
      name: "루이비통 키폴 반둘리에 25",
      description: "루이비통 키폴 반둘리에 25. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton Keepall Bandoulière 25",
      description: "Louis Vuitton Keepall Bandoulière 25，采用涂层帆布材质。",
    },
  },
  "bag-lv-capucines-bb": {
    ko: {
      name: "루이비통 카퓌신 BB",
      description: "루이비통 카퓌신 BB. 카프스킨 가죽 소재.",
    },
    zh: {
      name: "Louis Vuitton Capucines BB",
      description: "Louis Vuitton Capucines BB，采用小牛皮材质。",
    },
  },
  "bag-lv-carryall-vibe-mm": {
    ko: {
      name: "루이비통 캐리올 바이브 MM",
      description: "루이비통 캐리올 바이브 MM. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton CarryAll Vibe MM",
      description: "Louis Vuitton CarryAll Vibe MM，采用涂层帆布材质。",
    },
  },
  "bag-lv-carryall-cargo-vibe-pm": {
    ko: {
      name: "루이비통 캐리올 카고 바이브PM",
      description: "루이비통 캐리올 카고 바이브PM. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton CarryAll Cargo Vibe PM",
      description: "Louis Vuitton CarryAll Cargo Vibe PM，采用涂层帆布材质。",
    },
  },
  "bag-lv-all-in-bb": {
    ko: {
      name: "루이비통 올인BB",
      description: "루이비통 올인BB. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton All In BB",
      description: "Louis Vuitton All In BB，采用涂层帆布材质。",
    },
  },
  "bag-lv-all-in-bb-enflamment": {
    ko: {
      name: "루이비통 올인 BB 앙프랭",
      description: "루이비통 올인 BB 앙프랭. 코팅 캔버스 소재.",
    },
    zh: {
      name: "Louis Vuitton All In BB Enflamment",
      description: "Louis Vuitton All In BB Enflamment，采用涂层帆布材质。",
    },
  },
  "bag-miu-ivy-leather-mini": {
    ko: {
      name: "미우미우 아이비 가죽 백 미니",
      description: "미우미우 아이비 가죽 백 미니. 나파 가죽 소재.",
    },
    zh: {
      name: "Miu Miu Ivy Leather Bag Mini",
      description: "Miu Miu Ivy Leather Bag Mini，采用纳帕皮革材质。",
    },
  },
  "bag-miu-pocket-top-handle-medium": {
    ko: {
      name: "미우미우 나파가죽 포켓 탑핸들 백 미디엄",
      description: "미우미우 나파가죽 포켓 탑핸들 백 미디엄. 나파 가죽 소재.",
    },
    zh: {
      name: "Miu Miu Nappa Pocket Top-Handle Bag Medium",
      description: "Miu Miu Nappa Pocket Top-Handle Bag Medium，采用纳帕皮革材质。",
    },
  },
  "bag-miu-pocket-top-handle-small": {
    ko: {
      name: "미우미우 나파가죽 포켓 탑핸들 백 스몰",
      description: "미우미우 나파가죽 포켓 탑핸들 백 스몰. 나파 가죽 소재.",
    },
    zh: {
      name: "Miu Miu Nappa Pocket Top-Handle Bag Small",
      description: "Miu Miu Nappa Pocket Top-Handle Bag Small，采用纳帕皮革材质。",
    },
  },
  "bag-miu-wander-hobo-medium": {
    ko: {
      name: "미우미우 완더 마테라쎄 나파가죽 호보 백 미디엄",
      description: "미우미우 완더 마테라쎄 나파가죽 호보 백 미디엄. 나파 가죽 소재.",
    },
    zh: {
      name: "Miu Miu Wander Matelassé Nappa Hobo Medium",
      description: "Miu Miu Wander Matelassé Nappa Hobo Medium，采用纳帕皮革材质。",
    },
  },
  "bag-miu-wander-hobo-small": {
    ko: {
      name: "미우미우 완더 마테라쎄 나파가죽 호보 백 스몰",
      description: "미우미우 완더 마테라쎄 나파가죽 호보 백 스몰. 나파 가죽 소재.",
    },
    zh: {
      name: "Miu Miu Wander Matelassé Nappa Hobo Small",
      description: "Miu Miu Wander Matelassé Nappa Hobo Small，采用纳帕皮革材质。",
    },
  },
  "bag-miu-arcadie-suede": {
    ko: {
      name: "미우미우 아르카디 마테라쎄(스웨이드)",
      description: "미우미우 아르카디 마테라쎄(스웨이드). 가죽 및 스웨이드 소재.",
    },
    zh: {
      name: "Miu Miu Arcadie Matelassé (Suede)",
      description: "Miu Miu Arcadie Matelassé (Suede)，采用皮革与绒面革材质。",
    },
  },
  "bag-miu-arcadie-nappa": {
    ko: {
      name: "미우미우 아르카디 마테라쎄(나파 가죽)",
      description: "미우미우 아르카디 마테라쎄(나파 가죽). 나파 가죽 소재.",
    },
    zh: {
      name: "Miu Miu Arcadie Matelassé (Nappa Leather)",
      description: "Miu Miu Arcadie Matelassé (Nappa Leather)，采用纳帕皮革材质。",
    },
  },
  "bag-balenciaga-le-city-moto-medium": {
    ko: {
      name: "발렌시아가 르시티 모토 미디엄",
      description: "발렌시아가 르시티 모토 미디엄. 카프스킨 가죽 소재.",
    },
    zh: {
      name: "Balenciaga Le City Moto Medium",
      description: "Balenciaga Le City Moto Medium，采用小牛皮材质。",
    },
  },
  "bag-balenciaga-le-city-moto-small": {
    ko: {
      name: "발렌시아가 르시티 모토 스몰",
      description: "발렌시아가 르시티 모토 스몰. 카프스킨 가죽 소재.",
    },
    zh: {
      name: "Balenciaga Le City Moto Small",
      description: "Balenciaga Le City Moto Small，采用小牛皮材质。",
    },
  },
  "bag-balenciaga-rodeo-large": {
    ko: {
      name: "발렌시아가 로데오 백 라지",
      description: "발렌시아가 로데오 백 라지. 카프스킨 가죽 소재.",
    },
    zh: {
      name: "Balenciaga Rodeo Bag Large",
      description: "Balenciaga Rodeo Bag Large，采用小牛皮材质。",
    },
  },
  "bag-balenciaga-rodeo-medium": {
    ko: {
      name: "발렌시아가 로데오 백 미디엄",
      description: "발렌시아가 로데오 백 미디엄. 카프스킨 가죽 소재.",
    },
    zh: {
      name: "Balenciaga Rodeo Bag Medium",
      description: "Balenciaga Rodeo Bag Medium，采用小牛皮材质。",
    },
  },
  "bag-balenciaga-rodeo-small": {
    ko: {
      name: "발렌시아가 로데오 백 스몰",
      description: "발렌시아가 로데오 백 스몰. 카프스킨 가죽 소재.",
    },
    zh: {
      name: "Balenciaga Rodeo Bag Small",
      description: "Balenciaga Rodeo Bag Small，采用小牛皮材质。",
    },
  },
  "bag-chanel-classic-flap-medium": {
    ko: {
      name: "샤넬 클래식 플랩 미디움",
      description: "샤넬 클래식 플랩 미디움. 램스킨 가죽 소재.",
    },
    zh: {
      name: "Chanel Classic Flap Medium",
      description: "Chanel Classic Flap Medium，采用羔羊皮材质。",
    },
  },
  "bag-hermes-garden-party-30": {
    ko: {
      name: "에르메스 가든파티 30",
      description: "에르메스 가든파티 30. 클레망스 가죽 소재.",
    },
    zh: {
      name: "Hermès Garden Party 30",
      description: "Hermès Garden Party 30，采用Clemence 皮革材质。",
    },
  },
  "bag-hermes-birkin-25": {
    ko: {
      name: "에르메스 버킨백 25",
      description: "에르메스 버킨백 25. 클레망스 가죽 소재.",
    },
    zh: {
      name: "Hermès Birkin 25",
      description: "Hermès Birkin 25，采用Clemence 皮革材质。",
    },
  },
  "bag-hermes-picotin-22": {
    ko: {
      name: "에르메스 피코탄 22",
      description: "에르메스 피코탄 22. 클레망스 가죽 소재.",
    },
    zh: {
      name: "Hermès Picotin 22",
      description: "Hermès Picotin 22，采用Clemence 皮革材质。",
    },
  },
  "bag-hermes-picotin-18": {
    ko: {
      name: "에르메스 피코탄 18",
      description: "에르메스 피코탄 18. 클레망스 가죽 소재.",
    },
    zh: {
      name: "Hermès Picotin 18",
      description: "Hermès Picotin 18，采用Clemence 皮革材质。",
    },
  },

  "sneaker-lv-trainer-cream": {
    ko: {
      name: "모노그램 코트 트레이너",
      description:
        "레이어드 패널과 쿠션 안감, 세련된 실루엣의 로우 프로파일 가죽 스니커즈.",
    },
    zh: {
      name: "老花 Court 训练鞋",
      description: "低帮皮革训练鞋，配层叠鞋面、缓震内衬和精致日常廓形。",
    },
  },

  "sneaker-golden-star-white": {
    ko: {
      name: "빈티지 스타 가죽 스니커즈",
      description:
        "스웨이드 포인트와 대비되는 힐 디테일, 자연스러운 빈티지 마감의 디스트레스드 가죽 스니커즈.",
    },
    zh: {
      name: "复古星标皮革运动鞋",
      description: "做旧皮革运动鞋，配绒面革点缀、撞色后跟和柔和旧化质感。",
    },
  },

  "sneaker-miu-runner-silver": {
    ko: {
      name: "테크니컬 메시 러너",
      description:
        "스웨이드 오버레이, 메탈릭 포인트, 입체적인 아웃솔의 가벼운 믹스 소재 러닝화.",
    },
    zh: {
      name: "技术网面跑鞋",
      description: "轻盈混合材质跑鞋，配绒面革覆层、金属点缀和雕塑感鞋底。",
    },
  },

  "watch-cartier-tank-ivory": {
    ko: {
      name: "렉탱귤러 드레스 워치",
      description:
        "슬림한 직사각 케이스, 로마 숫자 인덱스, 광택 가죽 스트랩의 세련된 드레스 워치.",
    },
    zh: {
      name: "矩形正装腕表",
      description: "精致正装腕表，配纤薄矩形表壳、罗马刻度和抛光皮革表带。",
    },
  },

  "watch-rolex-diver-black": {
    ko: {
      name: "오토매틱 다이버 워치",
      description:
        "회전 베젤, 야광 인덱스, 브레이슬릿 스타일의 견고한 오토매틱 시계.",
    },
    zh: {
      name: "自动潜水腕表",
      description: "坚固自动腕表，配旋转表圈、夜光刻度和链带式轮廓。",
    },
  },

  "outerwear-moncler-quilted-black": {
    ko: {
      name: "퀼팅 다운 재킷",
      description:
        "입체적인 후드, 은은한 광택의 아웃쉘, 가벼운 보온 충전재의 따뜻한 퀼팅 재킷.",
    },
    zh: {
      name: "绗缝羽绒夹克",
      description: "保暖绗缝夹克，配立体兜帽、高光泽外层和轻盈保暖填充。",
    },
  },

  "outerwear-prada-hooded-slate": {
    ko: {
      name: "후디드 테크니컬 파카",
      description:
        "깔끔한 하드웨어, 패딩 보온성, 미니멀한 실루엣의 테크니컬 후드 파카.",
    },
    zh: {
      name: "连帽技术派克大衣",
      description: "技术感连帽派克，配简洁五金、保暖填充和极简都市廓形。",
    },
  },
};

const valueTranslations: Record<string, Partial<Record<LanguageCode, string>>> = {
  "color.black": { ko: "블랙", zh: "黑色" },
  "color.brown": { ko: "브라운", zh: "棕色" },
  "color.beige": { ko: "베이지", zh: "米色" },
  "color.gold": { ko: "골드", zh: "金色" },
  "color.blue": { ko: "블루", zh: "蓝色" },
  "color.green": { ko: "그린", zh: "绿色" },
  "color.ivory": { ko: "아이보리", zh: "象牙色" },
  "material.calfskin-leather": { ko: "카프스킨 가죽", zh: "小牛皮" },
  "material.coated-canvas": { ko: "코팅 캔버스", zh: "涂层帆布" },
  "material.lambskin-leather": { ko: "램스킨 가죽", zh: "羊皮" },
  "material.re-nylon": { ko: "리나일론", zh: "再生尼龙" },
  "material.clemence-leather": { ko: "클레망스 가죽", zh: "Clemence 皮革" },
  "material.embroidered-canvas": { ko: "자수 캔버스", zh: "刺绣帆布" },
  "material.nappa-leather": { ko: "나파 가죽", zh: "纳帕皮革" },
  "material.pebbled-leather": { ko: "페블 가죽", zh: "粒面皮革" },
  "category.bags": { ko: "가방", zh: "包袋" },
  "category.sneakers": { ko: "스니커즈", zh: "运动鞋" },
  "category.watches": { ko: "시계", zh: "腕表" },
  "category.outerwear": { ko: "아우터", zh: "外套" },
  "color.cream": { ko: "크림", zh: "奶油色" },
  "color.white": { ko: "화이트", zh: "白色" },
  "color.silver": { ko: "실버", zh: "银色" },
  "color.slate": { ko: "슬레이트", zh: "岩灰色" },
  "color.red": { ko: "레드", zh: "红色" },
  "material.leather-and-suede": { ko: "가죽 및 스웨이드", zh: "皮革与绒面革" },
  "material.mesh-and-suede": { ko: "메시 및 스웨이드", zh: "网面与绒面革" },
  "material.stainless-steel": { ko: "스테인리스 스틸", zh: "不锈钢" },
  "material.nylon-down": { ko: "나일론 다운", zh: "尼龙羽绒" },
  "material.technical-nylon": { ko: "테크니컬 나일론", zh: "技术尼龙" },
  "status.new": { ko: "신상품", zh: "新品" },
  "status.featured": { ko: "추천", zh: "精选" },
  "status.standard": { ko: "일반", zh: "标准" },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const fallbackLanguageContext: LanguageContextValue = {
  language: "en",
  languageOption: LANGUAGES[0],
  languages: LANGUAGES,
  setLanguage: () => {},
  t: (key, values) => interpolate(dictionaries.en[key] ?? key, values),
  formatCurrency: (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount),
  translateProductName: (_id, fallback) => fallback,
  translateProductDescription: (_id, fallback) => fallback,
  translateValue: (_scope, fallback) => fallback,
};

function normalizeLanguage(value: string | null | undefined): LanguageCode | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("en")) return "en";
  return null;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] == null ? match : String(values[key])
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    const stored = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
    const browser = normalizeLanguage(navigator.language);
    setLanguageState(stored ?? browser ?? "en");
  }, []);

  const languageOption =
    LANGUAGES.find((option) => option.code === language) ?? LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = languageOption.htmlLang;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language, languageOption.htmlLang]);

  const value = useMemo<LanguageContextValue>(() => {
    function t(key: string, values?: TranslationValues): string {
      const message = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
      return interpolate(message, values);
    }

    function formatCurrency(amount: number): string {
      if (amount >= 10000) {
        if (language === "ko") {
          return new Intl.NumberFormat("ko-KR", {
            style: "currency",
            currency: "KRW",
            maximumFractionDigits: 0,
          }).format(amount);
        }
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(Math.round(amount / 1350));
      }

      return new Intl.NumberFormat(languageOption.locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(amount);
    }

    function translateProductName(id: string, fallback: string): string {
      return (
        productTranslations[id]?.ko?.name ??
        productTranslations[id]?.[language]?.name ??
        fallback
      );
    }

    function translateProductDescription(id: string, fallback: string): string {
      return (
        productTranslations[id]?.ko?.description ??
        productTranslations[id]?.[language]?.description ??
        fallback
      );
    }

    function translateValue(scope: string, fallback: string): string {
      const key = `${scope}.${normalizeKey(fallback)}`;
      return valueTranslations[key]?.[language] ?? fallback;
    }

    return {
      language,
      languageOption,
      languages: LANGUAGES,
      setLanguage: setLanguageState,
      t,
      formatCurrency,
      translateProductName,
      translateProductDescription,
      translateValue,
    };
  }, [language, languageOption]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  return context ?? fallbackLanguageContext;
}

export function languageSearchParam(language: LanguageCode): string {
  return language === "en" ? "" : `lang=${language}`;
}
