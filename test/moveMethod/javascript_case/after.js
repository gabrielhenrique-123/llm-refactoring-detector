class Customer {
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }

  calculateLoyaltyPoints(amount) {
    if (this.type === 'VIP') {
      return amount * 2;
    } else {
      return amount * 1;
    }
  }
}

class Order {
  constructor(id, amount, customer) {
    this.id = id;
    this.amount = amount;
    this.customer = customer;
  }

  calculateLoyaltyPoints() {
    return this.customer.calculateLoyaltyPoints(this.amount);
  }
}
