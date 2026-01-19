#include <stdio.h>

int calculate_sum_of_squares(int x, int y) {
    return x * x + y * y;
}

int main() {
    int a = 3, b = 4;
    printf("Result: %d\n", calculate_sum_of_squares(a, b));
    return 0;
}
