import os
import json
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
from dotenv import load_dotenv
import google.generativeai as genai
import pandas as pd # --- NEW ---

# --- LOAD ENVIRONMENT AND CONFIGURE ---
load_dotenv()
print("Loading environment variables...")

gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")
genai.configure(api_key=gemini_api_key)

# --- DATABASE CONNECTION ---
server = os.getenv("SQL_SERVER", "localhost")
database = os.getenv("SQL_DATABASE", "OnJobSupport")
username = os.getenv("SQL_USERNAME")
password = os.getenv("SQL_PASSWORD")
DRIVER = os.getenv("ODBC_DRIVER", "ODBC Driver 18 for SQL Server")

def build_engine():
    if username and password:
        odbc_str = f"DRIVER={{{DRIVER}}};SERVER={server};DATABASE={database};UID={username};PWD={password};Encrypt=yes;TrustServerCertificate=yes;"
    else:
        odbc_str = f"DRIVER={{{DRIVER}}};SERVER={server};DATABASE={database};Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;"
    
    connect_uri = "mssql+pyodbc:///?odbc_connect=" + quote_plus(odbc_str)
    return create_engine(connect_uri)

def get_gemini_embedding(text: str, model="models/text-embedding-004"):
    try:
        return genai.embed_content(model=model, content=text)["embedding"]
    except Exception as e:
        print(f"Error generating embedding for text: '{text[:30]}...' -> {e}")
        return None

# --- MAIN SCRIPT LOGIC ---
def main():
    """Main function to embed and store data."""
    # --- MODIFIED: Read data from CSV file ---
    try:
        data_df = pd.read_csv("products.csv")
        print(f"Successfully loaded {len(data_df)} products from products.csv")
    except FileNotFoundError:
        print("Error: products.csv not found. Please create it.")
        return

    engine = build_engine()
    inserted_count = 0

    with engine.connect() as conn:
        with conn.begin() as trans:
            print("Deleting existing data from Products table...")
            conn.execute(text("DELETE FROM Products"))
            print("Table cleared.")

            print("Generating embeddings and inserting new data...")
            # --- MODIFIED: Iterate over the DataFrame rows ---
            for index, p in data_df.iterrows():
                text_blob = f"Product Name: {p['Name']}. Description: {p['ShortDescription']}. Details: {p['FullDescription']}"
                embedding = get_gemini_embedding(text_blob)

                if embedding:
                    embedding_str = json.dumps(embedding)
                    
                    sql_insert_query = text(f"""
                        INSERT INTO Products (Name, ShortDescription, FullDescription, Embedding)
                        VALUES (:n, :s, :f, CAST(N'{embedding_str}' AS VECTOR(768)))
                    """)
                    
                    conn.execute(
                        sql_insert_query,
                        {
                            "n": p["Name"],
                            "s": p["ShortDescription"],
                            "f": p["FullDescription"],
                        },
                    )
                    inserted_count += 1
                    print(f"  -> Inserted '{p['Name']}'")

        print(f"\n✅ Success! {inserted_count} products embedded and stored in the database.")

if __name__ == "__main__":
    main()