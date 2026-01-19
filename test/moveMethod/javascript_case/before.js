class Customer {
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }
}

class Order {
  constructor(id, amount, customer) {
    this.id = id;
    this.amount = amount;
    this.customer = customer;
  }

  calculateLoyaltyPoints() {
    if (this.customer.type === 'VIP') {
      return this.amount * 2;
    } else {
      return this.amount * 1;
    }
  }
}
