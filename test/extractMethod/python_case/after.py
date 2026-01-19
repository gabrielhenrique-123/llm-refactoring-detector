def calculate_order_total(order):
    total = 0
    for item in order['items']:
        total += item['price'] * item['quantity']
    
    if total > 100:
        total *= 0.9
    return total

def process_orders(orders):
    print("Starting order processing...")
    total_revenue = 0
    total_items = 0
    
    for order in orders:
        order_total = calculate_order_total(order)
            
        total_revenue += order_total
        total_items += len(order['items'])
        print(f"Order {order['id']} processed. Total: {order_total}")
        
    print(f"Total Revenue: {total_revenue}")
    print(f"Total Items: {total_items}")
