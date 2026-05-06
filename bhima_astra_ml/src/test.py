import pandas as pd
df = pd.read_csv("data/processed/workers_graph.csv")

print(df[["device_id","upi_id","bank_ifsc"]].nunique())
print(df["device_id"].value_counts().head(5))
print(df["upi_id"].value_counts().head(5))