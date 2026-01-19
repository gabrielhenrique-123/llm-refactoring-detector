def process_orders(orders):
    print("Starting order processing...")
    total_revenue = 0
    total_items = 0
    
    for order in orders:
        # Calculate order total
        order_total = 0
        for item in order['items']:
            order_total += item['price'] * item['quantity']
        
        # Apply discount
        if order_total > 100:
            order_total *= 0.9
            
        total_revenue += order_total
        total_items += len(order['items'])
        print(f"Order {order['id']} processed. Total: {order_total}")
        
    print(f"Total Revenue: {total_revenue}")
    print(f"Total Items: {total_items}")
