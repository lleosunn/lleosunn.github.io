def fib(num):
	if num <= 0:
		return [0]
	seq = [0,1]
	while len(seq) < num:
		yo = len(seq)
		new = seq[yo - 1] + seq[yo - 2]
		seq.append(new)
	return seq
	

def tester():
    num = int(input("Enter a number for Fibonacci Sequence: "))
    # check if the number is negative
    if num < 0:
        print("Sorry, Fibonacci Sequence does not exist for negative numbers")
    else:
        print("The fibbonacci sequence of ", num, "is", fib(num))

if __name__ == "__main__":
   # stuff only to run when not called via 'import' here
   tester()